import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { AckEnrollmentDto } from './dto/ack-enrollment.dto';
import { AgentRecognitionBatchDto } from './dto/agent-recognition.dto';
import { RecognitionService } from '../webhooks/recognition.service';

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
  constructor(
    private readonly agentService: AgentService,
    private readonly recognitionService: RecognitionService,
  ) {}

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

  /**
   * Reliable stamp path: local agent polls Face ID AcsEvent over LAN and
   * posts matches here. Survives flaky device→cloud webhooks.
   */
  @Post(':deviceId/recognition-events')
  async ingestRecognitionEvents(
    @Param('deviceId') deviceId: string,
    @Body() dto: AgentRecognitionBatchDto,
  ) {
    const results = [];
    for (const event of dto.events ?? []) {
      const employeeNo = String(event.employeeNo ?? '').trim();
      if (!employeeNo) {
        results.push({
          employeeNo: event.employeeNo,
          status: 'UNMATCHED',
          message: 'Empty employeeNo',
        });
        continue;
      }

      const eventDateTime = event.eventTime
        ? new Date(event.eventTime)
        : null;
      const dedupeKey = event.serialNo
        ? `serial:${event.serialNo}`
        : event.eventTime
          ? `time:${employeeNo}:${event.eventTime}`
          : undefined;

      const outcome = await this.recognitionService.ingestFaceMatch(deviceId, {
        employeeNo,
        eventDateTime:
          eventDateTime && !Number.isNaN(eventDateTime.getTime())
            ? eventDateTime
            : null,
        dedupeKey,
        rawPayload: {
          name: event.name,
          serialNo: event.serialNo,
          eventTime: event.eventTime,
        },
      });

      results.push({
        employeeNo,
        serialNo: event.serialNo,
        status: outcome.status,
        message: outcome.message,
        transactionId: outcome.transactionId,
      });
    }
    return { results };
  }
}
