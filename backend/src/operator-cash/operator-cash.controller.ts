import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';
import { OperatorCashService } from './operator-cash.service';
import { DepositOperatorCashDto } from './dto/deposit.dto';
import { EndShiftDto } from './dto/end-shift.dto';

@Controller('operator-cash')
@UseGuards(JwtStaffGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
export class OperatorCashController {
  constructor(private readonly operatorCashService: OperatorCashService) {}

  @Get('me')
  getMySummary(@CurrentUser() user: StaffJwtPayload) {
    return this.operatorCashService.getMySummary(user.sub);
  }

  @Get('me/entries')
  listMyEntries(
    @CurrentUser() user: StaffJwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.operatorCashService.listMyEntries(
      user.sub,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }

  @Get('peers')
  listPeers(@CurrentUser() user: StaffJwtPayload) {
    return this.operatorCashService.listHandoffPeers(user.sub);
  }

  @Post('deposit')
  deposit(
    @CurrentUser() user: StaffJwtPayload,
    @Body() dto: DepositOperatorCashDto,
  ) {
    return this.operatorCashService.deposit(user.sub, dto.amount, dto.note);
  }

  @Post('end-shift')
  endShift(
    @CurrentUser() user: StaffJwtPayload,
    @Body() dto: EndShiftDto,
  ) {
    return this.operatorCashService.endShift(
      user.sub,
      dto.toOperatorId,
      dto.confirmAmount,
    );
  }
}
