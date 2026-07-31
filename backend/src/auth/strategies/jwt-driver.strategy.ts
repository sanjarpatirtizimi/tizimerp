import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { DriverJwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtDriverStrategy extends PassportStrategy(
  Strategy,
  'jwt-driver',
) {
  constructor(configService: ConfigService) {
    const app = configService.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: app.jwt.accessSecret,
    });
  }

  validate(payload: DriverJwtPayload): DriverJwtPayload {
    if (payload.kind !== 'driver') {
      throw new UnauthorizedException('Invalid token kind for driver route');
    }
    return payload;
  }
}
