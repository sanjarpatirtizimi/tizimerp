import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AgentService } from './agent.service';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('devices')
@UseGuards(JwtStaffGuard, RolesGuard)
export class StaffEnrollmentQueueController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Drops Face ID photo-push jobs and soft-deletes drivers who never
   * received a stamp and were never enrolled on any terminal.
   */
  @Post('enrollment-queue/clear')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  clearEnrollmentQueue() {
    return this.agentService.resetEnrollmentBacklog();
  }
}
