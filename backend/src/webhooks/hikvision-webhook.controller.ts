import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { RecognitionService } from './recognition.service';

/**
 * Inbound endpoint the Hikvision device itself calls (as an HTTP client) the
 * moment it recognizes a face. Configure this URL as the device's
 * "HTTP Listening Host" notification address:
 *
 *   http://<your-server>/api/webhooks/hikvision/<deviceId>/recognition?secret=<HIKVISION_WEBHOOK_SECRET>
 *
 * The device posts `multipart/form-data` with a JSON `event_log` text part
 * (and usually a JPEG snapshot part, which we currently ignore beyond
 * receiving it — persist it under uploads/ if you need a photographic audit
 * trail of every stamp).
 */
@Controller('webhooks/hikvision')
export class HikvisionWebhookController {
  private readonly logger = new Logger(HikvisionWebhookController.name);

  constructor(private readonly recognitionService: RecognitionService) {}

  @Post(':deviceId/recognition')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  async handleRecognition(
    @Param('deviceId') deviceId: string,
    @Body() body: Record<string, unknown>,
    @Query('secret') secret: string | undefined,
  ) {
    this.recognitionService.verifyWebhookSecret(secret);

    const result = await this.recognitionService.handleRecognitionEvent(
      deviceId,
      body.event_log,
    );

    this.logger.log(`[${deviceId}] ${result.status}: ${result.message}`);

    // Always reply 200 with a simple ack — Hikvision devices don't do
    // anything useful with a non-200 beyond retrying, which we don't want
    // for e.g. an UNMATCHED event.
    return { received: true, status: result.status };
  }
}
