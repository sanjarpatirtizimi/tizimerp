require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { DigestHttpClient } = require("./digest-http-client");
const {
  pollNewFaceEvents,
  enqueueEvents,
  flushOutbox,
} = require("./acs-events");
const { prepareFaceJpeg } = require("./prepare-face-jpeg");
const { buildHikvisionFaceMultipart } = require("./hikvision-multipart");

const LOCK_PATH = path.join(__dirname, "agent.lock");

const {
  API_BASE_URL,
  DEVICE_ID,
  AGENT_KEY,
  DEVICE_IP,
  DEVICE_PORT = "80",
  DEVICE_USERNAME,
  DEVICE_PASSWORD,
  POLL_INTERVAL_MS = "1000",
  STAMP_POLL_ENABLED = "true",
} = process.env;

function assertConfig() {
  const required = {
    API_BASE_URL,
    DEVICE_ID,
    AGENT_KEY,
    DEVICE_IP,
    DEVICE_USERNAME,
    DEVICE_PASSWORD,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.error(
      `.env faylida quyidagi qiymatlar to'ldirilmagan: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  console.log(`[${new Date().toLocaleTimeString("uz-UZ")}] ${message}`);
}

function errorText(error) {
  if (error.response) {
    return `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`;
  }
  return error.message || String(error);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  const pid = process.pid;
  try {
    fs.writeFileSync(LOCK_PATH, String(pid), { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const prev = Number(String(fs.readFileSync(LOCK_PATH, "utf8")).trim());
    if (prev && isPidAlive(prev)) {
      console.error(
        `Shu papkada relay agent allaqachon ishlayapti (PID ${prev}). Shu papkadagi ikkinchi CMD ni yoping.`,
      );
      console.error(
        "Boshqa Face ID uchun alohida papka (masalan relay-agent2) ishlataverasiz.",
      );
      process.exit(1);
    }
    fs.writeFileSync(LOCK_PATH, String(pid));
  }
  const release = () => {
    try {
      if (
        fs.existsSync(LOCK_PATH) &&
        String(fs.readFileSync(LOCK_PATH, "utf8")).trim() === String(pid)
      ) {
        fs.unlinkSync(LOCK_PATH);
      }
    } catch {
      // ignore
    }
  };
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(0);
  });
}

/** Server/network glitch — keep job PENDING and retry. Do not mark FAILED. */
function isTransientNetworkError(error) {
  const code = error.code || "";
  const msg = errorText(error);
  return (
    code === "ECONNRESET" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    /timeout of \d+ms exceeded/i.test(msg) ||
    /ECONNRESET/i.test(msg) ||
    /ECONNREFUSED/i.test(msg) ||
    /socket hang up/i.test(msg) ||
    /HTTP 502/.test(msg) ||
    /HTTP 503/.test(msg) ||
    /HTTP 504/.test(msg)
  );
}

function describeEnrollError(error) {
  const message = errorText(error);
  if (
    /PicFeaturePoints/i.test(message) ||
    /SubpicAnalysisModelingError/i.test(message)
  ) {
    return (
      `${message} — Face ID yuz nuqtalarini o'qiy olmadi. ` +
      `Aniq, oldindan olingan yagona yuz rasmini qayta yuklang (ko'zoynaksiz, niqobsiz).`
    );
  }
  return message;
}

async function main() {
  assertConfig();
  acquireLock();

  const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${AGENT_KEY}` },
    timeout: 45000,
  });
  // Enrollment (face upload) can be slow; pechat uses a shorter timeout.
  const deviceClient = new DigestHttpClient(
    `http://${DEVICE_IP}:${DEVICE_PORT}`,
    DEVICE_USERNAME,
    DEVICE_PASSWORD,
    30000,
  );
  const stampDeviceClient = new DigestHttpClient(
    `http://${DEVICE_IP}:${DEVICE_PORT}`,
    DEVICE_USERNAME,
    DEVICE_PASSWORD,
    20000,
  );

  const stampApi = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${AGENT_KEY}` },
    timeout: 12000,
  });

  const pollMs = Number(POLL_INTERVAL_MS) || 500;
  let enrollmentEveryMs = 2_000;
  const heartbeatEveryMs = 20_000;
  let lastEnrollmentAt = 0;
  let lastHeartbeatAt = 0;
  let pollsOk = 0;
  let lastError = null;
  let enrollmentBusy = false;
  let resolvedDeviceId = DEVICE_ID;
  let lastEmptyLogAt = 0;

  log("Sanjar Patir relay agent ishga tushdi.");
  log("Versiya 1.1.0 — rasm: sharp baseline 4:2:0 (eski Jimp emas)");
  log(`Server: ${API_BASE_URL}`);
  log(`Qurilma (.env): ${DEVICE_ID} (${DEVICE_IP}:${DEVICE_PORT})`);
  log(`Pechat oralig'i: ${pollMs} ms (tez yo'l)`);
  log(
    STAMP_POLL_ENABLED === "false"
      ? "Pechat poll: o'chirilgan"
      : "Pechat poll: LAN AcsEvent (ishonchli yo'l)",
  );
  log("Haydovchi qo'shilsa logda 'yangi haydovchi' chiqadi. Oynani yopmang.");
  console.log("");

  try {
    let identified = false;
    try {
      const { data: status } = await api.get("/agent/whoami", {
        timeout: 20000,
      });
      if (status?.deviceId) {
        resolvedDeviceId = status.deviceId;
        identified = true;
        log(
          `Server qurilmani tanidi: ${status.name} (${status.deviceId}) — navbat: ${status.pendingCount ?? 0}`,
        );
      }
    } catch (error) {
      if (error.response?.status !== 404) throw error;
    }
    if (!identified) {
      const res = await api.get(`/agent/${DEVICE_ID}/pending`, {
        timeout: 20000,
      });
      const jobs = Array.isArray(res.data) ? res.data : [];
      log(
        `Server ulandi. Ro'yxat navbati: ${jobs.length} ta. Haydovchi qo'shilsa shu yerda chiqadi.`,
      );
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      log(`AGENT_KEY noto'g'ri (HTTP ${status}). Qurilmalar → Agent kaliti.`);
    } else {
      log(`Server hozir javob bermadi: ${errorText(error)}`);
      log("  Keyinroq o'zi qayta urinadi. Oynani yopmang.");
    }
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Pechat first — do not wait behind enrollment / Render cold starts.
    if (STAMP_POLL_ENABLED !== "false") {
      try {
        const events = await pollNewFaceEvents(stampDeviceClient, log);
        enqueueEvents(events);
        await flushOutbox(stampApi, resolvedDeviceId, log);
        pollsOk += 1;
        lastError = null;
      } catch (error) {
        const message = error.response
          ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
          : error.message;
        lastError = message;
        log(`AcsEvent/pechat xatosi: ${message}`);
      }
    }

    if (
      !enrollmentBusy &&
      Date.now() - lastEnrollmentAt >= enrollmentEveryMs
    ) {
      lastEnrollmentAt = Date.now();
      enrollmentBusy = true;
      // Never block pechat behind Render / Face ID enroll.
      void pollOnce(api, deviceClient, backendOrigin, resolvedDeviceId, {
        shouldLogEmpty: Date.now() - lastEmptyLogAt > 15_000,
        onLoggedEmpty: () => {
          lastEmptyLogAt = Date.now();
        },
      })
        .then(() => {
          enrollmentEveryMs = 2_000;
        })
        .catch((error) => {
          const message = errorText(error);
          if (isTransientNetworkError(error)) {
            enrollmentEveryMs = Math.min(enrollmentEveryMs * 2, 15_000);
            log(
              `Ro'yxatga olish: server band — ${Math.round(enrollmentEveryMs / 1000)}s dan keyin qayta. (${message})`,
            );
          } else {
            log(`Ro'yxatga olish poll xatosi: ${message}`);
          }
        })
        .finally(() => {
          enrollmentBusy = false;
        });
    }

    if (Date.now() - lastHeartbeatAt >= heartbeatEveryMs) {
      lastHeartbeatAt = Date.now();
      if (lastError) {
        log(`ishlayapti… oxirgi xato: ${lastError}`);
      } else {
        log(`ishlayapti… Face ID so'ralmoqda (${pollsOk} marta OK)`);
      }
    }

    await sleep(pollMs);
  }
}

async function pollOnce(api, deviceClient, backendOrigin, deviceId, opts = {}) {
  const { data: jobs } = await api.get(`/agent/${deviceId}/pending`, {
    timeout: 12000,
  });
  if (!Array.isArray(jobs) || jobs.length === 0) {
    if (opts.shouldLogEmpty) {
      log("Ro'yxat: navbat bo'sh (haydovchi qo'shilsa shu yerda chiqadi)");
      opts.onLoggedEmpty?.();
    }
    return;
  }

  log(`${jobs.length} ta yangi haydovchi topildi.`);

  for (const job of jobs) {
    const employeeNo = job.employeeNo || job.driverId;
    try {
      if (!employeeNo) throw new Error("employeeNo/driverId yo'q");
      if (!job.photoUrl) throw new Error("Haydovchida rasm yo'q");

      const photoResponse = await axios.get(`${backendOrigin}${job.photoUrl}`, {
        responseType: "arraybuffer",
        timeout: 45000,
      });
      const rawPhoto = Buffer.from(photoResponse.data);
      if (rawPhoto.length < 100) {
        throw new Error("Rasm fayli bo'sh yoki juda kichik");
      }

      const prepared = await prepareFaceJpeg(rawPhoto);
      const photoBuffer = prepared.buffer;
      log(
        `  rasm: ${Math.round(rawPhoto.length / 1024)} KB → ${Math.round(photoBuffer.length / 1024)} KB ` +
          `(${prepared.width}x${prepared.height} ${prepared.chroma}` +
          `${prepared.reencoded ? "" : ", original"})`,
      );

      await enrollOnDevice(deviceClient, employeeNo, job.fullName, photoBuffer);

      await api.post(`/agent/${deviceId}/pending/${job.registrationId}/ack`, {
        success: true,
        hikvisionFaceId: employeeNo,
      });
      log(`  ✓ ${job.fullName} yozildi (Person ID: ${employeeNo})`);
    } catch (error) {
      const message = describeEnrollError(error);
      if (isTransientNetworkError(error)) {
        log(
          `  · ${job.fullName}: server timeout — keyinroq qayta uriniladi (FAILED yozilmaydi)`,
        );
        continue;
      }
      log(`  ✗ ${job.fullName}: ${message}`);
      await api
        .post(`/agent/${deviceId}/pending/${job.registrationId}/ack`, {
          success: false,
          error: message.slice(0, 500),
        })
        .catch(() => undefined);
    }
  }
}

/**
 * Same two-step ISAPI flow as backend HikvisionService.enrollDriver.
 * employeeNo MUST be the platform driver.id — never a local "1"/"2".
 *
 * This device requires POST for UserInfo/Record (PUT → methodNotAllowed),
 * then PUT Modify if the person already exists.
 */
async function enrollOnDevice(deviceClient, employeeNo, fullName, photoBuffer) {
  const userBody = {
    UserInfo: {
      employeeNo,
      name: fullName,
      userType: "normal",
      Valid: {
        enable: true,
        beginTime: "2020-01-01T00:00:00",
        endTime: "2037-12-31T23:59:59",
        timeType: "local",
      },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  };

  let userInfoResponse = await deviceClient.post(
    "/ISAPI/AccessControl/UserInfo/Record?format=json",
    {
      data: userBody,
      headers: { "Content-Type": "application/json" },
    },
  );

  const recordFailed =
    userInfoResponse.status >= 400 ||
    (userInfoResponse.data &&
      userInfoResponse.data.statusCode &&
      userInfoResponse.data.statusCode !== 1);

  // Person already exists → update instead of failing the whole job.
  if (recordFailed) {
    userInfoResponse = await deviceClient.put(
      "/ISAPI/AccessControl/UserInfo/Modify?format=json",
      {
        data: userBody,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const modifyFailed =
    userInfoResponse.status >= 400 ||
    (userInfoResponse.data &&
      userInfoResponse.data.statusCode &&
      userInfoResponse.data.statusCode !== 1);

  if (modifyFailed) {
    throw new Error(
      `UserInfo: HTTP ${userInfoResponse.status} ${JSON.stringify(userInfoResponse.data)}`,
    );
  }

  const facePayload = buildHikvisionFaceMultipart(employeeNo, photoBuffer);

  // Create face record (POST). This model rejects POST FDSetUp (methodNotAllowed).
  let faceResponse = await deviceClient.post(
    "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
    facePayload,
  );

  // Already has a face / create failed → update via PUT FDSetUp.
  if (isIsapiFailure(faceResponse)) {
    faceResponse = await deviceClient.put(
      "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
      buildHikvisionFaceMultipart(employeeNo, photoBuffer),
    );
  }

  // Still failing → delete prior face record then recreate.
  if (isIsapiFailure(faceResponse)) {
    await deviceClient
      .put("/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json", {
        data: {
          FaceModeList: [
            {
              faceMode: {
                faceLibType: "blackFD",
                FDID: "1",
                FPID: employeeNo,
              },
            },
          ],
        },
        headers: { "Content-Type": "application/json" },
      })
      .catch(() => undefined);

    faceResponse = await deviceClient.post(
      "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
      buildHikvisionFaceMultipart(employeeNo, photoBuffer),
    );
  }

  if (isIsapiFailure(faceResponse)) {
    throw new Error(
      `FDLib face upload: HTTP ${faceResponse.status} ${JSON.stringify(faceResponse.data)}`,
    );
  }
}

function isIsapiFailure(response) {
  if (response.status >= 400) return true;
  return Boolean(
    response.data &&
      response.data.statusCode &&
      response.data.statusCode !== 1,
  );
}

main();
