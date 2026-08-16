import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { DriverMeController } from './driver-me.controller';
import { PublicDriverPhotosController } from './public-driver-photos.controller';
import { PublicSelfRegisterController } from './public-self-register.controller';
import { HikvisionModule } from '../hikvision/hikvision.module';

@Module({
  imports: [HikvisionModule],
  controllers: [
    DriversController,
    DriverMeController,
    PublicDriverPhotosController,
    PublicSelfRegisterController,
  ],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
