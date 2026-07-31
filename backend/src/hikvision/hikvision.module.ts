import { Module } from '@nestjs/common';
import { HikvisionService } from './hikvision.service';

@Module({
  providers: [HikvisionService],
  exports: [HikvisionService],
})
export class HikvisionModule {}
