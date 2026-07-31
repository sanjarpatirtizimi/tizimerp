import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
