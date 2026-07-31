import { Type } from 'class-transformer';
import { IsNumber, IsNotEmpty, IsString } from 'class-validator';

export class ManualAdjustmentDto {
  /** Positive to credit the driver, negative to debit them. */
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
