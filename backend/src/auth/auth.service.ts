import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DriverStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import {
  DriverJwtPayload,
  StaffJwtPayload,
} from '../common/decorators/current-user.decorator';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const OTP_TTL_MINUTES = 5;
const OTP_LENGTH = 6;

@Injectable()
export class AuthService {
  private readonly appConfig: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.appConfig = configService.get<AppConfig>('app')!;
  }

  // ---------------------------------------------------------------------
  // Staff (Operator / SuperAdmin) auth
  // ---------------------------------------------------------------------

  async staffLogin(phone: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: StaffJwtPayload = {
      kind: 'staff',
      sub: user.id,
      role: user.role,
    };
    return this.issueTokenPair(payload, { userId: user.id });
  }

  // ---------------------------------------------------------------------
  // Driver auth — password OR OTP
  // ---------------------------------------------------------------------

  async driverPasswordLogin(
    phone: string,
    password: string,
  ): Promise<TokenPair> {
    const driver = await this.prisma.driver.findUnique({ where: { phone } });
    if (
      !driver ||
      !driver.passwordHash ||
      driver.status === DriverStatus.BLOCKED
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, driver.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: DriverJwtPayload = { kind: 'driver', sub: driver.id };
    return this.issueTokenPair(payload, { driverId: driver.id });
  }

  /**
   * Generates and "sends" an OTP for a driver login.
   * NOTE: actual SMS delivery is not wired up yet — replace the console.log
   * below with an SMS gateway integration (e.g. Eskiz, Play Mobile) when ready.
   */
  async requestDriverOtp(phone: string): Promise<{ message: string }> {
    const driver = await this.prisma.driver.findUnique({ where: { phone } });
    if (!driver || driver.status === DriverStatus.BLOCKED) {
      // Do not leak whether the phone number exists.
      return { message: 'If this number is registered, an OTP has been sent.' };
    }

    const code = randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
    const codeHash = this.hashToken(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { driverId: driver.id, code: codeHash, expiresAt },
    });

    // TODO: integrate SMS gateway. For now, log for local development.

    console.log(`[DEV ONLY] OTP for driver ${phone}: ${code}`);

    return { message: 'If this number is registered, an OTP has been sent.' };
  }

  async verifyDriverOtp(phone: string, code: string): Promise<TokenPair> {
    const driver = await this.prisma.driver.findUnique({ where: { phone } });
    if (!driver || driver.status === DriverStatus.BLOCKED) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const codeHash = this.hashToken(code);
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        driverId: driver.id,
        code: codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    if (driver.status === DriverStatus.PENDING) {
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.ACTIVE },
      });
    }

    const payload: DriverJwtPayload = { kind: 'driver', sub: driver.id };
    return this.issueTokenPair(payload, { driverId: driver.id });
  }

  // ---------------------------------------------------------------------
  // Self-service password change (staff)
  // ---------------------------------------------------------------------

  async changeStaffPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate every existing refresh token so other sessions must re-login.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------
  // Refresh / logout — shared for staff + driver
  // ---------------------------------------------------------------------

  async refresh(refreshToken: string): Promise<TokenPair> {
    let decoded: StaffJwtPayload | DriverJwtPayload;
    try {
      decoded = this.jwtService.verify(refreshToken, {
        secret: this.appConfig.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // `decoded` still carries `iat`/`exp` from the old token — signing it
    // again as-is makes jsonwebtoken throw ("payload already has an exp
    // property"), so rebuild a clean payload with only our own claims.
    if (decoded.kind === 'staff') {
      const payload: StaffJwtPayload = {
        kind: 'staff',
        sub: decoded.sub,
        role: decoded.role,
      };
      return this.issueTokenPair(payload, { userId: decoded.sub });
    }
    const payload: DriverJwtPayload = { kind: 'driver', sub: decoded.sub };
    return this.issueTokenPair(payload, { driverId: decoded.sub });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokenPair(
    payload: StaffJwtPayload | DriverJwtPayload,
    owner: { userId?: string; driverId?: string },
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.appConfig.jwt.accessSecret,
      expiresIn: this.appConfig.jwt.accessExpiresIn as never,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.appConfig.jwt.refreshSecret,
      expiresIn: this.appConfig.jwt.refreshExpiresIn as never,
    });

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: owner.userId,
        driverId: owner.driverId,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
