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

/** Same face often creates 2–3 AcsEvent serials — collapse within this window. */
const PERSON_DEBOUNCE_MS = Number(process.env.PERSON_DEBOUNCE_MS) || 30_000;

function loadState() {
  return readJson(STATE_PATH, {
    seenKeys: [],
    lastPersonAt: {},
    lastPollAt: null,
  });
}

function saveState(state) {
  if (Array.isArray(state.seenKeys) && state.seenKeys.length > 2000) {
    state.seenKeys = state.seenKeys.slice(-1500);
  }
  if (state.lastPersonAt && typeof state.lastPersonAt === "object") {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [person, ts] of Object.entries(state.lastPersonAt)) {
      if (typeof ts !== "number" || ts < cutoff) {
        delete state.lastPersonAt[person];
      }
    }
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

let cachedDeviceClock = null;

/**
 * Read device clock so AcsEvent start/end match the terminal's timezone.
 * Cached briefly so we do not hit /ISAPI/System/time every poll.
 */
async function getDeviceTimeWindow(deviceClient, lookbackMs) {
  const now = Date.now();
  if (
    !cachedDeviceClock ||
    now - cachedDeviceClock.fetchedAt > 120_000
  ) {
    let offsetMinutes = -new Date().getTimezoneOffset();
    let end = new Date();
    try {
      const res = await deviceClient.get("/ISAPI/System/time");
      const xml = typeof res.data === "string" ? res.data : "";
      const localMatch = xml.match(/<localTime>([^<]+)<\/localTime>/i);
      if (localMatch) {
        const raw = localMatch[1].trim();
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
          end = parsed;
          const off = raw.match(/([+-])(\d{2}):(\d{2})$/);
          if (off) {
            const sign = off[1] === "-" ? -1 : 1;
            offsetMinutes =
              sign * (parseInt(off[2], 10) * 60 + parseInt(off[3], 10));
          }
        }
      }
    } catch {
      // PC clock fallback
    }
    cachedDeviceClock = {
      offsetMinutes,
      endMs: end.getTime(),
      fetchedAt: now,
    };
  } else {
    // Advance cached end with wall-clock drift since last fetch
    cachedDeviceClock.endMs += now - cachedDeviceClock.fetchedAt;
    cachedDeviceClock.fetchedAt = now;
  }

  const end = new Date(cachedDeviceClock.endMs);
  const start = new Date(end.getTime() - lookbackMs);
  return {
    startTime: formatWithOffset(start, cachedDeviceClock.offsetMinutes),
    endTime: formatWithOffset(end, cachedDeviceClock.offsetMinutes),
  };
}

async function postAcsEvent(deviceClient, cond) {
  return deviceClient.post("/ISAPI/AccessControl/AcsEvent?format=json", {
    data: { AcsEventCond: cond },
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Fetch face-success events, preferring the newest page when total > maxResults.
 */
async function fetchFaceRows(deviceClient, base) {
  const first = await postAcsEvent(deviceClient, {
    ...base,
    searchID: String(Date.now()),
    searchResultPosition: 0,
    minor: 75,
  });
  if (first.status >= 400) {
    throw new Error(
      `AcsEvent HTTP ${first.status} ${JSON.stringify(first.data).slice(0, 240)}`,
    );
  }

  const acs = first.data?.AcsEvent || {};
  const total = Number(acs.totalMatches || 0);
  let list = acs.InfoList || acs.infoList || [];
  if (!Array.isArray(list)) list = [];

  // If more matches than one page, jump near the end to get newest events.
  if (total > base.maxResults) {
    const position = Math.max(0, total - base.maxResults);
    const page = await postAcsEvent(deviceClient, {
      ...base,
      searchID: String(Date.now() + 1),
      searchResultPosition: position,
      minor: 75,
    });
    if (page.status < 400) {
      const newer =
        page.data?.AcsEvent?.InfoList ||
        page.data?.AcsEvent?.infoList ||
        [];
      if (Array.isArray(newer) && newer.length) list = newer;
    }
  }

  return { total, list };
}

/**
 * Poll Face ID access events over LAN and return newly seen face matches.
 */
async function pollNewFaceEvents(deviceClient, log) {
  const state = loadState();
  const seen = new Set(state.seenKeys || []);
  // Short window = faster AcsEvent query on the terminal.
  const { startTime, endTime } = await getDeviceTimeWindow(
    deviceClient,
    3 * 60 * 1000,
  );

  const base = {
    searchResultPosition: 0,
    maxResults: 30,
    major: 5,
    startTime,
    endTime,
  };

  const { total, list: rows } = await fetchFaceRows(deviceClient, base);

  const fresh = [];
  let skippedSeen = 0;
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
    if (seen.has(key)) {
      skippedSeen += 1;
      continue;
    }

    // Hikvision often emits multiple serials for one glance — keep first only.
    const lastPersonAt =
      state.lastPersonAt && typeof state.lastPersonAt === "object"
        ? state.lastPersonAt
        : {};
    const prevAt = Number(lastPersonAt[employeeNo] || 0);
    if (prevAt && Date.now() - prevAt < PERSON_DEBOUNCE_MS) {
      skippedSeen += 1;
      seen.add(key); // mark serial seen so it does not reappear later
      continue;
    }

    seen.add(key);
    lastPersonAt[employeeNo] = Date.now();
    state.lastPersonAt = lastPersonAt;
    fresh.push(event);
  }

  state.seenKeys = [...seen];
  state.lastPollAt = new Date().toISOString();

  if (fresh.length > 0) {
    log(
      `AcsEvent: ${fresh.length} ta YANGI yuz (${total} jami oynada) ${startTime} → ${endTime}`,
    );
  } else if (total > 0 && skippedSeen > 0) {
    // Device has events but none are new — usually means a second face touch
    // did not create a new AcsEvent serial (device-side interval/optimization).
    const lastSkip = state.lastSkipLogAt ? Date.parse(state.lastSkipLogAt) : 0;
    if (Date.now() - lastSkip > 60_000) {
      log(
        `AcsEvent: yangi serial yo'q (qurilmada ${total} ta eski voqea). Yuzdan keyin pechat ~bir necha soniyada keladi.`,
      );
      state.lastSkipLogAt = new Date().toISOString();
    }
  }

  saveState(state);
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
        log(
          `  · takroriy e'tiborsiz: Person ID ${r.employeeNo} — bir qarashda 2-chi voqea (yoki cooldown). ${r.message || ""}`,
        );
      } else if (String(r.message || "").includes("Duplicate")) {
        log(`  · duplicate (shu serial oldin yozilgan): Person ID ${r.employeeNo}`);
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
