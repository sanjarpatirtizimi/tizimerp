import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { MeController } from './me.controller';
import { OperatorCashModule } from '../operator-cash/operator-cash.module';

@Module({
  imports: [OperatorCashModule],
  controllers: [LedgerController, MeController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
