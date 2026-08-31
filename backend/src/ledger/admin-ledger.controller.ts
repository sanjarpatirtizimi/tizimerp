import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { ResetAllStampsDto } from './dto/reset-all-stamps.dto';
import { JwtStaffGuard } from '../common/guards/jwt-staff.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { StaffJwtPayload } from '../common/decorators/current-user.decorator';

/**
 * Bulk ledger admin actions — kept out of `LedgerController` (which is
 * scoped to a single `:driverId`) so a "reset everyone" mistake can never
 * be made by hitting the wrong `:driverId`.
 */
@Controller('drivers/stamps')
@UseGuards(JwtStaffGuard, RolesGuard)
export class AdminLedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * "Barcha pechatlarni tozalash": redeems every outstanding pechat for
   * every driver (haydovchi ma'lumotlari o'zgarmaydi — faqat pechat/pul
   * qoldig'i 0'ga tushadi). SuperAdmin only.
   */
  @Post('reset-all')
  @Roles(UserRole.SUPER_ADMIN)
  resetAll(
    @Body() dto: ResetAllStampsDto,
    @CurrentUser() user: StaffJwtPayload,
  ) {
    return this.ledgerService.resetAllDriversStamps(user.sub, dto.note);
  }
}
