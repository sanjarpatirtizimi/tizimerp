import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { StaffJwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStaffStrategy extends PassportStrategy(Strategy, 'jwt-staff') {
  constructor(configService: ConfigService) {
    const app = configService.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: app.jwt.accessSecret,
    });
  }

  validate(payload: StaffJwtPayload): StaffJwtPayload {
    if (payload.kind !== 'staff') {
      throw new UnauthorizedException('Invalid token kind for staff route');
    }
    return payload;
  }
}
