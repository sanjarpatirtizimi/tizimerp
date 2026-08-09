import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class RequeueEnrollmentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  deviceIds!: string[];
}
