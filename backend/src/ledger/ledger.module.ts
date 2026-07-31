import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { MeController } from './me.controller';

@Module({
  controllers: [LedgerController, MeController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
