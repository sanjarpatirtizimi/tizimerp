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
  // Cap memory so the file cannot grow forever.
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

function toLocalIso(date) {
  // Hikvision often wants local-looking timestamps without timezone.
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Poll Face ID access events over LAN and return newly seen face matches.
 * This is the reliable stamp source — does not depend on device→cloud webhooks.
 */
async function pollNewFaceEvents(deviceClient, log) {
  const state = loadState();
  const seen = new Set(state.seenKeys || []);

  const end = new Date();
  const start = new Date(end.getTime() - 3 * 60 * 1000); // last 3 minutes

  const body = {
    AcsEventCond: {
      searchID: String(Date.now()),
      searchResultPosition: 0,
      maxResults: 50,
      major: 5, // access controller event
      // minor omitted: firmwares differ (75=face success, etc). Filter below.
      startTime: toLocalIso(start),
      endTime: toLocalIso(end),
    },
  };

  let response = await deviceClient.post(
    "/ISAPI/AccessControl/AcsEvent?format=json",
    {
      data: body,
      headers: { "Content-Type": "application/json" },
    },
  );

  // Some firmwares only accept lowercase path.
  if (response.status >= 400) {
    response = await deviceClient.post(
      "/ISAPI/AccessControl/AcsEvent?format=json",
      {
        data: {
          AcsEventCond: {
            ...body.AcsEventCond,
            minor: 75,
          },
        },
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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

  const rows = Array.isArray(list) ? list : [];
  const fresh = [];

  for (const row of rows) {
    const minor = Number(row.minor ?? row.Minor ?? 0);
    const employeeNo = pickEmployeeNo(row);
    if (!employeeNo) continue;
    // 76 = face authentication failure on many firmwares.
    if (minor === 76) continue;

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
    log(`AcsEvent: ${fresh.length} ta yangi yuz voqeasi`);
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

  // Send in small batches.
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
    // Drop successfully posted batch (server accepted the HTTP call).
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
