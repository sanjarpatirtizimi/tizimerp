import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtDriverGuard } from '../common/guards/jwt-driver.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DriverJwtPayload } from '../common/decorators/current-user.decorator';

/** Driver self-service: view own balance and transaction history. Read-only. */
@Controller('me')
@UseGuards(JwtDriverGuard)
export class MeController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('balance')
  getBalance(@CurrentUser() driver: DriverJwtPayload) {
    return this.ledgerService.getDriverSummary(driver.sub);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() driver: DriverJwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ledgerService.listTransactions(
      driver.sub,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }
}
