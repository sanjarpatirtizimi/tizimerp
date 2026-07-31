import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  /** Optional — lets the Operator set an initial password so the driver can log in immediately. */
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

  /**
   * IDs of the Hikvision devices/gates to enroll this driver's face on.
   * Sent as multipart form fields, so it may arrive as a JSON string or a
   * repeated field — this normalizes both into a string[].
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as string[]) : [value];
      } catch {
        return value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    return undefined;
  })
  deviceIds?: string[];
}
