import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a staff endpoint to the given User roles (SUPER_ADMIN / OPERATOR). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
