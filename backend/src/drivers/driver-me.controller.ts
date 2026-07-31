import { Controller, Get, UseGuards } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtDriverGuard } from '../common/guards/jwt-driver.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DriverJwtPayload } from '../common/decorators/current-user.decorator';

/** Driver self-service profile (name, plate, status) — balance/history live under /me in LedgerModule. */
@Controller('me')
@UseGuards(JwtDriverGuard)
export class DriverMeController {
  constructor(private readonly driversService: DriversService) {}

  @Get('profile')
  getProfile(@CurrentUser() driver: DriverJwtPayload) {
    return this.driversService.getProfile(driver.sub);
  }
}
