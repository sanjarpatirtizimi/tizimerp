import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { CashAdvanceDto } from './dto/cash-advance.dto';
import { GoodsExchangeDto } from './dto/goods-exchange.dto';
import { ManualAdjustmentDto } from './dto/manual-adjustment.dto';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';

/** Staff-facing endpoints: Operators issue advances/exchanges, SuperAdmin can adjust. */
@Controller('drivers/:driverId')
@UseGuards(JwtStaffGuard, RolesGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('balance')
  getBalance(@Param('driverId') driverId: string) {
    return this.ledgerService.getDriverSummary(driverId);
  }

  @Get('transactions')
  getTransactions(
    @Param('driverId') driverId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ledgerService.listTransactions(
      driverId,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }

  @Post('cash-advances')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  issueCashAdvance(
    @Param('driverId') driverId: string,
    @Body() dto: CashAdvanceDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.ledgerService.issueCashAdvance({
      driverId,
      operatorId: user.sub,
      amount: dto.amount,
      description: dto.description,
    });
  }

  @Post('goods-exchanges')
  @Roles(UserRole.OPERATOR, UserRole.SUPER_ADMIN)
  exchangeGoods(
    @Param('driverId') driverId: string,
    @Body() dto: GoodsExchangeDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.ledgerService.exchangeGoods({
      driverId,
      operatorId: user.sub,
      productId: dto.productId,
      quantity: dto.quantity ?? 1,
      description: dto.description,
    });
  }

  @Post('adjustments')
  @Roles(UserRole.SUPER_ADMIN)
  manualAdjustment(
    @Param('driverId') driverId: string,
    @Body() dto: ManualAdjustmentDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.ledgerService.manualAdjustment({
      driverId,
      adminId: user.sub,
      amount: dto.amount,
      reason: dto.reason,
    });
  }
}
