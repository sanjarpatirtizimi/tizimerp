import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResetAllStampsDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
