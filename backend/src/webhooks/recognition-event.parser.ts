import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { HikvisionEventLogDto } from './dto/hikvision-event.dto';

export interface ParsedRecognitionEvent {
  dto: HikvisionEventLogDto;
  employeeNo: string | null;
  eventType: string | null;
  eventDateTime: Date | null;
  validationErrors: ValidationError[];
  raw: unknown;
}

/**
 * Hikvision firmware is inconsistent about the exact casing of keys inside
 * `AccessControllerEvent` (some send `employeeNoString`, older/rebranded
 * OEM firmware sometimes sends `EmployeeNoString` with a capital E, etc).
 * This does a case-insensitive lookup so we don't silently drop the match.
 */
function findCaseInsensitive(
  obj: Record<string, unknown> | undefined,
  key: string,
): unknown {
  if (!obj) return undefined;
  const directHit = obj[key];
  if (directHit !== undefined) return directHit;

  const lowerKey = key.toLowerCase();
  const foundKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey);
  return foundKey ? obj[foundKey] : undefined;
}

function normalizeEventLog(raw: unknown): Record<string, unknown> | null {
  let parsed: unknown = raw;

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;

  const accessEventRaw = (findCaseInsensitive(
    record,
    'AccessControllerEvent',
  ) ?? undefined) as Record<string, unknown> | undefined;

  const normalizedAccessEvent = accessEventRaw
    ? {
        employeeNoString: findCaseInsensitive(
          accessEventRaw,
          'employeeNoString',
        ),
        employeeNo: findCaseInsensitive(accessEventRaw, 'employeeNo'),
        name: findCaseInsensitive(accessEventRaw, 'name'),
        cardNo: findCaseInsensitive(accessEventRaw, 'cardNo'),
        currentVerifyMode: findCaseInsensitive(
          accessEventRaw,
          'currentVerifyMode',
        ),
        attendanceStatus: findCaseInsensitive(
          accessEventRaw,
          'attendanceStatus',
        ),
        purpose: findCaseInsensitive(accessEventRaw, 'purpose'),
      }
    : undefined;

  return {
    ipAddress: findCaseInsensitive(record, 'ipAddress'),
    dateTime: findCaseInsensitive(record, 'dateTime'),
    eventType: findCaseInsensitive(record, 'eventType'),
    eventState: findCaseInsensitive(record, 'eventState'),
    eventDescription: findCaseInsensitive(record, 'eventDescription'),
    AccessControllerEvent: normalizedAccessEvent,
  };
}

/**
 * Parses + validates the `event_log` text field Hikvision posts inside its
 * `multipart/form-data` webhook body. Never throws — a device sends many
 * non-recognition events (heartbeats, tamper alarms, etc) that legitimately
 * won't have an `employeeNo`, and we always want to log those, not 500.
 */
export async function parseEventLog(
  rawEventLog: unknown,
): Promise<ParsedRecognitionEvent> {
  const normalized = normalizeEventLog(rawEventLog);

  const dto = plainToInstance(HikvisionEventLogDto, normalized ?? {});
  const validationErrors = await validate(dto, {
    whitelist: false,
    skipMissingProperties: true,
  });

  const employeeNo =
    dto.AccessControllerEvent?.employeeNoString ??
    dto.AccessControllerEvent?.employeeNo ??
    null;

  const eventDateTime = dto.dateTime ? new Date(dto.dateTime) : null;

  return {
    dto,
    employeeNo: employeeNo && employeeNo !== '' ? employeeNo : null,
    eventType: dto.eventType ?? null,
    eventDateTime:
      eventDateTime && !Number.isNaN(eventDateTime.getTime())
        ? eventDateTime
        : null,
    validationErrors,
    raw: rawEventLog,
  };
}
