import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeedbackStatus, UserRole } from '@prisma/client';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { JwtDriverGuard } from '../common/guards/jwt-driver.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  DriverJwtPayload,
  StaffJwtPayload,
} from '../common/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtDriverGuard)
  create(
    @CurrentUser() driver: DriverJwtPayload,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(driver.sub, dto);
  }

  @Get()
  @UseGuards(JwtStaffGuard, RolesGuard)
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  list(
    @Query('status') status?: FeedbackStatus,
    @Query('take') take?: string,
  ) {
    return this.feedbackService.listForStaff(
      status,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Patch(':id')
  @UseGuards(JwtStaffGuard, RolesGuard)
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
    @CurrentUser() _user: StaffJwtPayload,
  ) {
    return this.feedbackService.update(id, dto);
  }
}
