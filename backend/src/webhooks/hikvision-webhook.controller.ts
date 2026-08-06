import {
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

/**
 * Inbound endpoint the Hikvision device itself calls (as an HTTP client) the
 * moment it recognizes a face. Configure this URL as the device's
 * "HTTP Listening Host" notification address (Configuration → Network →
 * Advanced Settings → Network → HTTP Listening Host on a DS-K1T671):
 *
 *   URL:  http://<your-server>/api/webhooks/hikvision/<deviceId>/recognition?secret=<HIKVISION_WEBHOOK_SECRET>
 *   Post Type: JSON
 *
 * Depending on firmware/settings, the device posts one of several shapes —
 * we accept all of them:
 *   1. `multipart/form-data` with a text part named `event_log` — a JSON
 *      string containing `dateTime`, `eventType`, and (for face/card
 *      matches) a nested `AccessControllerEvent` object with
 *      `employeeNoString`.
 *   2. `multipart/form-data` with that SAME JSON string under a
 *      differently-named text part — e.g. some DS-K1T671 firmware names
 *      the field `AccessControllerEvent` instead of `event_log`. We don't
 *      rely on the field name at all: we scan every text field for one
 *      that looks like a JSON object.
 *   3. A plain `application/json` body that IS the event object itself
 *      (no wrapper) — used when the device's "Post Type" is JSON without
 *      picture upload.
 * All shapes may additionally include zero or more binary image parts
 * (the matched face snapshot) under a device-specific field name.
 */
/**
 * Finds whichever field actually holds the event JSON, regardless of what
 * the device named it. Prefers the conventional `event_log` field; falls
 * back to the first string field that looks like a JSON object (handles
 * firmware that names the field e.g. `AccessControllerEvent`); finally
 * falls back to the whole body (plain-JSON, no-wrapper case).
 */
function extractEventLogCandidate(
  body: Record<string, unknown> | undefined,
): unknown {
  if (typeof body?.event_log === 'string') return body.event_log;

  for (const value of Object.values(body ?? {})) {
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      return value;
    }
  }

  return body;
}

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
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    this.recognitionService.verifyWebhookSecret(secret);

    // Log every single inbound hit unconditionally (before any parsing/
    // matching can fail) — if the device's URL/secret is misconfigured
    // this is the only trace you'll have to debug it from Render logs.
    this.logger.log(
      `[${deviceId}] webhook hit — bodyKeys=[${Object.keys(body ?? {}).join(', ')}] files=${files?.length ?? 0}`,
    );

    const rawEventLog = extractEventLogCandidate(body);

    // Some firmware sends the snapshot as a plain image field, others as a
    // named field like "Picture1.jpg" — we don't rely on the field name,
    // just take the first image-looking attachment, if any.
    const photo = files?.find((f) => f.mimetype?.startsWith('image/'));

    const result = await this.recognitionService.handleRecognitionEvent(
      deviceId,
      rawEventLog,
      photo?.buffer,
    );

    this.logger.log(`[${deviceId}] ${result.status}: ${result.message}`);

    // Always reply 200 with a simple ack — Hikvision devices don't do
    // anything useful with a non-200 beyond retrying, which we don't want
    // for e.g. an UNMATCHED event.
    return { received: true, status: result.status };
  }
}
