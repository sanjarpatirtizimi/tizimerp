const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "acs-state.json");
const OUTBOX_PATH = path.join(__dirname, "acs-outbox.json");

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function loadState() {
  return readJson(STATE_PATH, { seenKeys: [], lastPollAt: null });
}

function saveState(state) {
  if (Array.isArray(state.seenKeys) && state.seenKeys.length > 2000) {
    state.seenKeys = state.seenKeys.slice(-1500);
  }
  writeJson(STATE_PATH, state);
}

function loadOutbox() {
  const items = readJson(OUTBOX_PATH, []);
  return Array.isArray(items) ? items : [];
}

function saveOutbox(items) {
  writeJson(OUTBOX_PATH, items.slice(-500));
}

function eventKey(event) {
  if (event.serialNo != null && String(event.serialNo) !== "") {
    return `serial:${event.serialNo}`;
  }
  return `time:${event.employeeNo}:${event.eventTime || ""}`;
}

function pickEmployeeNo(row) {
  const candidates = [
    row.employeeNoString,
    row.employeeNo,
    row.EmployeeNoString,
    row.EmployeeNo,
    row.personId,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Format an absolute Date in a fixed offset (device timezone), e.g. +08:00.
 * Do NOT mix in the PC's getTimezoneOffset — that shifted the window by hours
 * and made AcsEvent return NO MATCH even right after a face scan.
 */
function formatWithOffset(date, offsetMinutes) {
  const local = new Date(date.getTime() + offsetMinutes * 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${oh}:${om}`
  );
}

/**
 * Read device clock so AcsEvent start/end match the terminal's timezone.
 * Falls back to PC local offset if device time is unavailable.
 */
async function getDeviceTimeWindow(deviceClient, lookbackMs) {
  let offsetMinutes = -new Date().getTimezoneOffset(); // PC local
  let end = new Date();

  try {
    const res = await deviceClient.get("/ISAPI/System/time");
    const xml = typeof res.data === "string" ? res.data : "";
    const localMatch = xml.match(/<localTime>([^<]+)<\/localTime>/i);
    if (localMatch) {
      const raw = localMatch[1].trim();
      // e.g. 2026-08-10T18:59:56+08:00
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        end = parsed;
        const off = raw.match(/([+-])(\d{2}):(\d{2})$/);
        if (off) {
          const sign = off[1] === "-" ? -1 : 1;
          offsetMinutes = sign * (parseInt(off[2], 10) * 60 + parseInt(off[3], 10));
        }
      }
    }
  } catch {
    // keep PC clock fallback
  }

  const start = new Date(end.getTime() - lookbackMs);
  return {
    startTime: formatWithOffset(start, offsetMinutes),
    endTime: formatWithOffset(end, offsetMinutes),
  };
}

async function postAcsEvent(deviceClient, cond) {
  return deviceClient.post("/ISAPI/AccessControl/AcsEvent?format=json", {
    data: { AcsEventCond: cond },
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Poll Face ID access events over LAN and return newly seen face matches.
 * This device requires `minor` (MessageParametersLack without it) and
 * maxResults ≤ 30. Time window is taken from the device clock.
 */
async function pollNewFaceEvents(deviceClient, log) {
  const state = loadState();
  const seen = new Set(state.seenKeys || []);
  const { startTime, endTime } = await getDeviceTimeWindow(
    deviceClient,
    15 * 60 * 1000,
  );

  const base = {
    searchID: "1",
    searchResultPosition: 0,
    maxResults: 30,
    major: 5,
    startTime,
    endTime,
  };

  // This terminal requires minor. 75 = face auth success on most Hikvision AC units.
  const minorsToTry = [75, 38]; // 75 face success, 38 card success (harmless if unused)
  let rows = [];
  let lastError = null;

  for (const minor of minorsToTry) {
    const response = await postAcsEvent(deviceClient, { ...base, minor });
    if (response.status >= 400) {
      lastError = `AcsEvent HTTP ${response.status} ${JSON.stringify(response.data).slice(0, 240)}`;
      continue;
    }
    const list =
      response.data?.AcsEvent?.InfoList ||
      response.data?.AcsEvent?.infoList ||
      response.data?.InfoList ||
      [];
    if (Array.isArray(list) && list.length) {
      rows = rows.concat(list);
    } else if (response.status < 400) {
      lastError = null; // valid empty result
    }
  }

  if (lastError && rows.length === 0) {
    // One more attempt: only minor=75 (required success path)
    const response = await postAcsEvent(deviceClient, { ...base, minor: 75 });
    if (response.status >= 400) {
      throw new Error(
        `AcsEvent HTTP ${response.status} ${JSON.stringify(response.data).slice(0, 240)}`,
      );
    }
    const list =
      response.data?.AcsEvent?.InfoList ||
      response.data?.AcsEvent?.infoList ||
      response.data?.InfoList ||
      [];
    rows = Array.isArray(list) ? list : [];
  }

  const fresh = [];
  for (const row of rows) {
    const minor = Number(row.minor ?? row.Minor ?? 0);
    const employeeNo = pickEmployeeNo(row);
    if (!employeeNo) continue;
    if (minor === 76) continue; // face fail

    const event = {
      employeeNo,
      eventTime: row.time || row.Time || null,
      serialNo:
        row.serialNo != null
          ? String(row.serialNo)
          : row.SerialNo != null
            ? String(row.SerialNo)
            : undefined,
      name: row.name || row.Name || undefined,
    };
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(event);
  }

  state.seenKeys = [...seen];
  state.lastPollAt = new Date().toISOString();
  saveState(state);

  if (fresh.length > 0) {
    log(`AcsEvent: ${fresh.length} ta yangi yuz voqeasi (${startTime} → ${endTime})`);
  }
  return fresh;
}

function enqueueEvents(events) {
  if (!events.length) return;
  const outbox = loadOutbox();
  const existing = new Set(outbox.map((e) => eventKey(e)));
  for (const event of events) {
    const key = eventKey(event);
    if (existing.has(key)) continue;
    outbox.push({ ...event, queuedAt: new Date().toISOString() });
    existing.add(key);
  }
  saveOutbox(outbox);
}

async function flushOutbox(api, deviceId, log) {
  const outbox = loadOutbox();
  if (!outbox.length) return;

  const batch = outbox.slice(0, 40);
  try {
    const { data } = await api.post(
      `/agent/${deviceId}/recognition-events`,
      { events: batch },
      { timeout: 30000 },
    );
    const results = data?.results || [];
    for (const r of results) {
      if (r.status === "PROCESSED") {
        log(`  ✓ pechat: Person ID ${r.employeeNo} (${r.message})`);
      } else if (r.status === "IGNORED_COOLDOWN") {
        log(`  · cooldown: Person ID ${r.employeeNo}`);
      } else if (String(r.message || "").includes("Duplicate")) {
        // already stored
      } else {
        log(`  · ${r.status}: Person ID ${r.employeeNo} — ${r.message}`);
      }
    }
    saveOutbox(outbox.slice(batch.length));
  } catch (error) {
    const message = error.response
      ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
      : error.message;
    log(`Pechat navbatini serverga yuborib bo'lmadi (keyinroq qayta): ${message}`);
  }
}

module.exports = {
  pollNewFaceEvents,
  enqueueEvents,
  flushOutbox,
};
