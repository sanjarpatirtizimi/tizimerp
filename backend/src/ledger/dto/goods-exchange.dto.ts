import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class GoodsExchangeDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
