import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DevicesService } from '../devices/devices.service';

/**
 * Authenticates local relay-agent requests (see `AgentController`) using a
 * per-device API key, sent as `Authorization: Bearer <key>` and checked
 * against `Device.agentKeyHash`. Attaches the verified device to the
 * request so handlers don't need to re-fetch it.
 */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private readonly devicesService: DevicesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const deviceId = request.params.deviceId as string;
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing agent key');
    }
    const key = authHeader.slice('Bearer '.length).trim();

    const device = await this.devicesService.verifyAgentKey(deviceId, key);
    (request as Request & { device: typeof device }).device = device;
    return true;
  }
}
