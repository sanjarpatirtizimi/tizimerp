import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('analytics')
@UseGuards(JwtStaffGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(@Query('month') month?: string) {
    return this.analyticsService.getDashboard(month);
  }

  @Get('daily')
  getDaily(@Query('date') date?: string) {
    return this.analyticsService.getDailyReport(date);
  }
}
