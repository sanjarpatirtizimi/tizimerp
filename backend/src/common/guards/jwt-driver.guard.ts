import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid access token issued to a Driver. */
@Injectable()
export class JwtDriverGuard extends AuthGuard('jwt-driver') {}
