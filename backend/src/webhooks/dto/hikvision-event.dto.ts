import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * The `AccessControllerEvent` object nested inside Hikvision's `event_log`
 * JSON — this is where the recognized person's identity lives. Field names
 * and casing below match the DS-K1T671 / standard ISAPI "Access Control
 * Event" notification. Almost everything is optional because different
 * firmware versions/event types populate different subsets of these fields
 * (e.g. a tamper alarm has no `employeeNoString` at all).
 */
export class AccessControllerEventDto {
  /** The Person ID enrolled on the device — this is what we match against Driver.id. */
  @IsOptional()
  @IsString()
  employeeNoString?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cardNo?: string;

  /** e.g. "faceMatch", "card", "fingerPrint" */
  @IsOptional()
  @IsString()
  currentVerifyMode?: string;

  /** e.g. "checkIn", "checkOut" — only present when attendance mode is enabled. */
  @IsOptional()
  @IsString()
  attendanceStatus?: string;

  /** 1 = success match, other codes = failure/unknown — varies by firmware. */
  @IsOptional()
  purpose?: number;
}

/**
 * Top-level `event_log` payload Hikvision access-control terminals POST as a
 * `multipart/form-data` text part when they fire an "HTTP Listening"
 * notification (device Configuration → Network → Advanced → HTTP Listening
 * Host, "Post Type: JSON").
 */
export class HikvisionEventLogDto {
  @IsOptional()
  @IsString()
  ipAddress?: string;

  /** ISO-8601-ish timestamp reported by the device's own clock. */
  @IsOptional()
  @IsDateString()
  dateTime?: string;

  /** e.g. "AccessControllerEvent" for face/card recognition notifications. */
  @IsOptional()
  @IsString()
  eventType?: string;

  /** e.g. "active" */
  @IsOptional()
  @IsIn(['active', 'inactive'])
  eventState?: string;

  @IsOptional()
  @IsString()
  eventDescription?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControllerEventDto)
  AccessControllerEvent?: AccessControllerEventDto;
}
