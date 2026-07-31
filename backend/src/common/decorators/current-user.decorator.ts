import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface StaffJwtPayload {
  kind: 'staff';
  sub: string;
  role: 'SUPER_ADMIN' | 'OPERATOR';
}

export interface DriverJwtPayload {
  kind: 'driver';
  sub: string;
}

/** Pulls the authenticated principal (set by JwtStaffGuard / JwtDriverGuard) off the request. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): StaffJwtPayload | DriverJwtPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: StaffJwtPayload | DriverJwtPayload }>();
    return request.user;
  },
);
