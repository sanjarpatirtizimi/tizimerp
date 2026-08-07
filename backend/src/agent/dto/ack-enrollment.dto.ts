import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AckEnrollmentDto {
  @IsBoolean()
  success: boolean;

  /** The Person ID/employeeNo the relay assigned on the device, on success. */
  @IsString()
  @IsOptional()
  hikvisionFaceId?: string;

  @IsString()
  @IsOptional()
  error?: string;
}
