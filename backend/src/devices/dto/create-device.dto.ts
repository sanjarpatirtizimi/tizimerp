import {
  IsIP,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Only needed if you want this app to control the device via ISAPI (push enrollment, ping). */
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

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
