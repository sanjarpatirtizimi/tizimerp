import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, TokenPair } from './auth.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import {
  DriverPasswordLoginDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/driver-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  staffLogin(@Body() dto: StaffLoginDto): Promise<TokenPair> {
    return this.authService.staffLogin(dto.phone, dto.password);
  }

  @Post('driver/login')
  @HttpCode(HttpStatus.OK)
  driverPasswordLogin(@Body() dto: DriverPasswordLoginDto): Promise<TokenPair> {
    return this.authService.driverPasswordLogin(dto.phone, dto.password);
  }

  @Post('driver/otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestDriverOtp(dto.phone);
  }

  @Post('driver/otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<TokenPair> {
    return this.authService.verifyDriverOtp(dto.phone, dto.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
