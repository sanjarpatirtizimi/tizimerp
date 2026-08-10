import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class FlagVisitDto {
  @IsBoolean()
  isRedFlagged: boolean;

  /** Required when placing a red flag; ignored when clearing. */
  @ValidateIf((o: FlagVisitDto) => o.isRedFlagged === true)
  @IsString()
  @MinLength(2, { message: 'Izoh kamida 2 ta belgidan iborat bo‘lishi kerak' })
  @MaxLength(500)
  flagNote?: string;
}
