import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class FlagVisitDto {
  @IsBoolean()
  isRedFlagged: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  flagNote?: string;
}
