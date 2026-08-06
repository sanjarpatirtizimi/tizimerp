import {
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsIP()
  @IsOptional()
  ipAddress?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  username?: string;

  /** Only sent when the operator wants to change it; omit to keep the current one. */
  @IsString()
  @MinLength(1)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
