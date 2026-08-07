import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { AckEnrollmentDto } from './dto/ack-enrollment.dto';

/**
 * Called by the local "relay agent" (a small program running on a device
 * on the SAME local network as a Hikvision terminal — e.g. a tablet at the
 * gate) to fetch newly-added drivers and report back once their face has
 * been pushed to the terminal via local ISAPI. Authenticated with a
 * per-device API key (see `DevicesController.generateAgentKey`), NOT the
 * staff JWT — the tablet never logs in as a user.
 */
@Controller('agent')
@UseGuards(AgentKeyGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get(':deviceId/pending')
  listPending(@Param('deviceId') deviceId: string) {
    return this.agentService.listPending(deviceId);
  }

  @Post(':deviceId/pending/:registrationId/ack')
  ack(
    @Param('deviceId') deviceId: string,
    @Param('registrationId') registrationId: string,
    @Body() dto: AckEnrollmentDto,
  ) {
    return this.agentService.ack(deviceId, registrationId, dto);
  }
}
