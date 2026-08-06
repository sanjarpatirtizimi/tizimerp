import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { RecognitionService } from './recognition.service';
import { HikvisionWebhookBodyDto } from './dto/hikvision-event.dto';

/**
 * Inbound endpoint the Hikvision device itself calls (as an HTTP client) the
 * moment it recognizes a face. Configure this URL as the device's
 * "HTTP Listening Host" notification address (Configuration → Network →
 * Advanced Settings → Network → HTTP Listening Host on a DS-K1T671):
 *
 *   URL:  http://<your-server>/api/webhooks/hikvision/<deviceId>/recognition?secret=<HIKVISION_WEBHOOK_SECRET>
 *   Post Type: JSON
 *
 * The device posts `multipart/form-data` with:
 *   - a text part named `event_log` — a JSON string containing `dateTime`,
 *     `eventType`, and (for face/card matches) a nested
 *     `AccessControllerEvent` object with `employeeNoString`.
 *   - zero or more binary image parts (the matched face snapshot) under a
 *     device-specific field name — we accept ANY field name via
 *     `AnyFilesInterceptor` and just take whatever image comes through.
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
    @Body() body: HikvisionWebhookBodyDto,
    @Query('secret') secret: string | undefined,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    this.recognitionService.verifyWebhookSecret(secret);

    if (!body?.event_log) {
      throw new BadRequestException('Missing event_log field in webhook body');
    }

    // Some firmware sends the snapshot as a plain image field, others as a
    // named field like "Picture1.jpg" — we don't rely on the field name,
    // just take the first image-looking attachment, if any.
    const photo = files?.find((f) => f.mimetype?.startsWith('image/'));

    const result = await this.recognitionService.handleRecognitionEvent(
      deviceId,
      body.event_log,
      photo?.buffer,
    );

    this.logger.log(`[${deviceId}] ${result.status}: ${result.message}`);

    // Always reply 200 with a simple ack — Hikvision devices don't do
    // anything useful with a non-200 beyond retrying, which we don't want
    // for e.g. an UNMATCHED event.
    return { received: true, status: result.status };
  }
}
