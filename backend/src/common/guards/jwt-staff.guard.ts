import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid access token issued to a staff User (Operator/SuperAdmin). */
@Injectable()
export class JwtStaffGuard extends AuthGuard('jwt-staff') {}
