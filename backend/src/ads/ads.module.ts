import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AdsController } from './ads.controller';
import { AdsMeController } from './ads-me.controller';
import { PublicAdImagesController } from './public-ad-images.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AdsController, AdsMeController, PublicAdImagesController],
  providers: [AdsService],
})
export class AdsModule {}
