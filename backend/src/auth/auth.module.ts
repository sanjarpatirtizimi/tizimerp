import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStaffStrategy } from './strategies/jwt-staff.strategy';
import { JwtDriverStrategy } from './strategies/jwt-driver.strategy';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStaffStrategy, JwtDriverStrategy],
  exports: [AuthService],
})
export class AuthModule {}
