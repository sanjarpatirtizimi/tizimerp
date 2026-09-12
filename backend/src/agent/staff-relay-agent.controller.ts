import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AgentConfigPayload } from './relay-agent-manager.service';
import { RelayAgentManagerService } from './relay-agent-manager.service';

@Controller('staff/relay-agents')
@UseGuards(JwtStaffGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
export class StaffRelayAgentController {
  constructor(private readonly managerService: RelayAgentManagerService) {}

  /** List all devices that have a relay agent key. */
  @Get()
  list() {
    return this.managerService.listAgents();
  }

  /** Get recent logs for one device. */
  @Get(':deviceId/logs')
  getLogs(
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.managerService.getLogs(deviceId, limit ? Number(limit) : 100);
  }

  /** Clear all logs for a device. */
  @Delete(':deviceId/logs')
  @Roles(UserRole.SUPER_ADMIN)
  clearLogs(@Param('deviceId') deviceId: string) {
    return this.managerService.clearLogs(deviceId);
  }

  /** Get remote config for a device. */
  @Get(':deviceId/config')
  getConfig(@Param('deviceId') deviceId: string) {
    return this.managerService.getConfig(deviceId);
  }

  /** Save remote config for a device (agent will pick it up on next heartbeat). */
  @Put(':deviceId/config')
  @Roles(UserRole.SUPER_ADMIN)
  setConfig(
    @Param('deviceId') deviceId: string,
    @Body() config: AgentConfigPayload,
  ) {
    return this.managerService.setConfig(deviceId, config);
  }
}
