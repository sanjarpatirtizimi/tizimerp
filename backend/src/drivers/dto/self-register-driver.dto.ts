import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SelfRegisterDriverDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  carPlate!: string;

  @IsString()
  @IsNotEmpty()
  carBrand!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}
