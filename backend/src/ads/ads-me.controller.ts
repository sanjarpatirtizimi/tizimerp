import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service';
import { JwtDriverGuard } from '../common/guards/jwt-driver.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DriverJwtPayload } from '../common/decorators/current-user.decorator';

@Controller('me/ads')
@UseGuards(JwtDriverGuard)
export class AdsMeController {
  constructor(private readonly adsService: AdsService) {}

  @Get('active')
  getActive(@CurrentUser() driver: DriverJwtPayload) {
    return this.adsService.getActiveForDriver(driver.sub);
  }

  @Post(':id/dismiss')
  dismiss(
    @Param('id') id: string,
    @CurrentUser() driver: DriverJwtPayload,
  ) {
    return this.adsService.dismissForDriver(id, driver.sub);
  }
}
