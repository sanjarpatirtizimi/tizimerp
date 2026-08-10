import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { DevicesModule } from '../devices/devices.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [DevicesModule, WebhooksModule],
  controllers: [AgentController],
  providers: [AgentService, AgentKeyGuard],
})
export class AgentModule {}
