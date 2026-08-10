import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

function toOptionalString({ value }: { value: unknown }): string | undefined {
  if (value == null || value === '') return undefined;
  return String(value);
}

export class AgentRecognitionEventDto {
  @Transform(toOptionalString)
  @IsString()
  employeeNo: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  eventTime?: string;

  /** Device event serial — used for exactly-once dedupe. */
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  serialNo?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  name?: string;
}

export class AgentRecognitionBatchDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AgentRecognitionEventDto)
  events: AgentRecognitionEventDto[];
}
