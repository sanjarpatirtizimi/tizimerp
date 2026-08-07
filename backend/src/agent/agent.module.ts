import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from './agent-key.guard';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  controllers: [AgentController],
  providers: [AgentService, AgentKeyGuard],
})
export class AgentModule {}
