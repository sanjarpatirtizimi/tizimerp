import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDriverDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  phone?: string;

  /** If provided, replaces the driver's login password. */
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  carPlate?: string;

  @IsString()
  @IsOptional()
  carBrand?: string;

  @IsString()
  @IsOptional()
  carModel?: string;
}
