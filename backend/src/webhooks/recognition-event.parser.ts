/**
 * Hikvision Access Control terminals POST recognition events as
 * `multipart/form-data` with a text part named `event_log` (JSON) plus
 * optional image parts (e.g. `pic`, `jpeg_stream`). The JSON shape below is
 * Hikvision's standard `AccessControllerEvent` payload — field names are
 * stable across recent firmware but always double-check against your
 * specific device model's ISAPI event log.
 */
export interface HikvisionAccessControllerEvent {
  employeeNoString?: string;
  employeeNo?: string;
  name?: string;
  currentVerifyMode?: string;
  attendanceStatus?: string;
}

export interface HikvisionEventLog {
  ipAddress?: string;
  dateTime?: string;
  eventType?: string;
  eventState?: string;
  eventDescription?: string;
  AccessControllerEvent?: HikvisionAccessControllerEvent;
}

export interface ParsedRecognitionEvent {
  employeeNo: string | null;
  eventType: string | null;
  raw: unknown;
}

/**
 * `event_log` may arrive as a JSON string, or (older firmware) as XML — this
 * only handles the JSON case, which is what you get when the device's HTTP
 * listening host is configured with `format=json` / "Post Type: JSON".
 */
export function parseEventLog(rawEventLog: unknown): ParsedRecognitionEvent {
  let parsed: HikvisionEventLog | null = null;

  if (typeof rawEventLog === 'string') {
    try {
      parsed = JSON.parse(rawEventLog) as HikvisionEventLog;
    } catch {
      parsed = null;
    }
  } else if (rawEventLog && typeof rawEventLog === 'object') {
    parsed = rawEventLog;
  }

  const employeeNo =
    parsed?.AccessControllerEvent?.employeeNoString ??
    parsed?.AccessControllerEvent?.employeeNo ??
    null;

  return {
    employeeNo: employeeNo && employeeNo !== '' ? employeeNo : null,
    eventType: parsed?.eventType ?? null,
    raw: rawEventLog,
  };
}
