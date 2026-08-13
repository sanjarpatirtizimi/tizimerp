import { Module } from '@nestjs/common';
import { OperatorCashService } from './operator-cash.service';
import { OperatorCashController } from './operator-cash.controller';

@Module({
  controllers: [OperatorCashController],
  providers: [OperatorCashService],
  exports: [OperatorCashService],
})
export class OperatorCashModule {}
