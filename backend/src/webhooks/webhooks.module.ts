import { Module } from '@nestjs/common';
import { HikvisionWebhookController } from './hikvision-webhook.controller';
import { RecognitionService } from './recognition.service';

@Module({
  controllers: [HikvisionWebhookController],
  providers: [RecognitionService],
})
export class WebhooksModule {}
