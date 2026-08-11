import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StampRedeemKind } from '@prisma/client';

export class RedeemStampsDto {
  /** How many unredeemed pechats to redeem (FIFO, oldest first). */
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  count: number;

  @IsEnum(StampRedeemKind)
  kind: StampRedeemKind;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
