import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { DevicesModule } from '../devices/devices.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { PublicRelayAgentController } from './public-relay-agent.controller';
import { StaffEnrollmentQueueController } from './staff-enrollment-queue.controller';

@Module({
  imports: [DevicesModule, WebhooksModule],
  controllers: [
    AgentController,
    PublicRelayAgentController,
    StaffEnrollmentQueueController,
  ],
  providers: [AgentService, AgentKeyGuard],
})
export class AgentModule {}
