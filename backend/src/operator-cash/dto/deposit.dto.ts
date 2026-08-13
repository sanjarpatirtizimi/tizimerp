import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DepositOperatorCashDto {
  @IsNumber()
  @Min(1)
  @Max(999_999_999_999)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
