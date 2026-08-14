import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Device } from '@prisma/client';

/** Device attached by AgentKeyGuard (resolved from agent key, not URL slug). */
export const CurrentDevice = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Device => {
    const request = ctx.switchToHttp().getRequest<{ device: Device }>();
    return request.device;
  },
);
