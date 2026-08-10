import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';
import { VisitsService } from './visits.service';
import { FlagVisitDto } from './dto/flag-visit.dto';

@Controller('visits')
@UseGuards(JwtStaffGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get('recent')
  listRecent(
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.visitsService.listRecent(
      take ? parseInt(take, 10) : 50,
      cursor,
    );
  }

  @Get('flagged')
  listFlagged(
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.visitsService.listFlagged(
      take ? parseInt(take, 10) : 50,
      cursor,
    );
  }

  @Patch(':id/flag')
  setFlag(
    @Param('id') id: string,
    @Body() dto: FlagVisitDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.visitsService.setFlag(id, dto, user.sub);
  }
}
