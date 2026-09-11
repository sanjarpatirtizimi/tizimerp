import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { DevicesModule } from '../devices/devices.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { PublicRelayAgentController } from './public-relay-agent.controller';
import { StaffEnrollmentQueueController } from './staff-enrollment-queue.controller';
import { StaffRelayAgentController } from './staff-relay-agent.controller';
import { RelayAgentManagerService } from './relay-agent-manager.service';

@Module({
  imports: [DevicesModule, WebhooksModule],
  controllers: [
    AgentController,
    PublicRelayAgentController,
    StaffEnrollmentQueueController,
    StaffRelayAgentController,
  ],
  providers: [AgentService, AgentKeyGuard, RelayAgentManagerService],
})
export class AgentModule {}
