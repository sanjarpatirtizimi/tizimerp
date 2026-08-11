import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  body?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  telegramUsername?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkUrl?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  /** 1–100; omit for 100% of drivers. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  audiencePercent?: number;
}
