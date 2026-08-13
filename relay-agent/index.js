require("dotenv").config();
const axios = require("axios");
const Jimp = require("jimp");
const { DigestHttpClient } = require("./digest-http-client");
const {
  pollNewFaceEvents,
  enqueueEvents,
  flushOutbox,
} = require("./acs-events");

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

async function main() {
  assertConfig();

  const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${AGENT_KEY}` },
    timeout: 20000,
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
    8000,
  );

  const stampApi = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${AGENT_KEY}` },
    timeout: 12000,
  });

  const pollMs = Number(POLL_INTERVAL_MS) || 500;
  const enrollmentEveryMs = 10_000;
  const heartbeatEveryMs = 30_000;
  let lastEnrollmentAt = 0;
  let lastHeartbeatAt = 0;
  let pollsOk = 0;
  let lastError = null;

  log("Sanjar Patir relay agent ishga tushdi.");
  log(`Server: ${API_BASE_URL}`);
  log(`Qurilma: ${DEVICE_ID} (${DEVICE_IP}:${DEVICE_PORT})`);
  log(`Pechat oralig'i: ${pollMs} ms (tez yo'l)`);
  log(
    STAMP_POLL_ENABLED === "false"
      ? "Pechat poll: o'chirilgan"
      : "Pechat poll: LAN AcsEvent (ishonchli yo'l)",
  );
  log("Yangi yuz bo'lmasa ham har 30 soniyada 'ishlayapti' chiqadi. Oynani yopmang.");
  console.log("");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Pechat first — do not wait behind enrollment / Render cold starts.
    if (STAMP_POLL_ENABLED !== "false") {
      try {
        const events = await pollNewFaceEvents(stampDeviceClient, log);
        enqueueEvents(events);
        await flushOutbox(stampApi, DEVICE_ID, log);
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

    if (Date.now() - lastEnrollmentAt >= enrollmentEveryMs) {
      lastEnrollmentAt = Date.now();
      try {
        await pollOnce(api, deviceClient, backendOrigin);
      } catch (error) {
        const message = error.response
          ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
          : error.message;
        log(`Ro'yxatga olish poll xatosi: ${message}`);
      }
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

async function pollOnce(api, deviceClient, backendOrigin) {
  const { data: jobs } = await api.get(`/agent/${DEVICE_ID}/pending`);
  if (!Array.isArray(jobs) || jobs.length === 0) return;

  log(`${jobs.length} ta yangi haydovchi topildi.`);

  for (const job of jobs) {
    const employeeNo = job.employeeNo || job.driverId;
    try {
      if (!employeeNo) throw new Error("employeeNo/driverId yo'q");
      if (!job.photoUrl) throw new Error("Haydovchida rasm yo'q");

      const photoResponse = await axios.get(`${backendOrigin}${job.photoUrl}`, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const rawPhoto = Buffer.from(photoResponse.data);
      if (rawPhoto.length < 100) {
        throw new Error("Rasm fayli bo'sh yoki juda kichik");
      }

      const photoBuffer = await prepareFaceJpeg(rawPhoto);
      log(
        `  rasm: ${Math.round(rawPhoto.length / 1024)} KB → ${Math.round(photoBuffer.length / 1024)} KB (Face ID uchun)`,
      );

      await enrollOnDevice(deviceClient, employeeNo, job.fullName, photoBuffer);

      await api.post(`/agent/${DEVICE_ID}/pending/${job.registrationId}/ack`, {
        success: true,
        hikvisionFaceId: employeeNo,
      });
      log(`  ✓ ${job.fullName} yozildi (Person ID: ${employeeNo})`);
    } catch (error) {
      const message = error.response
        ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
        : error.message;
      log(`  ✗ ${job.fullName}: ${message}`);
      await api
        .post(`/agent/${DEVICE_ID}/pending/${job.registrationId}/ack`, {
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

/**
 * Normalize any common phone image (JPEG/PNG/WebP) into a small frontal JPEG
 * Face ID terminals accept (~max 600px, under ~180 KB).
 */
async function prepareFaceJpeg(input) {
  try {
    const image = await Jimp.read(input);
    const maxSide = 640;
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    if (w > maxSide || h > maxSide) {
      if (w >= h) image.resize(maxSide, Jimp.AUTO);
      else image.resize(Jimp.AUTO, maxSide);
    }

    let quality = 85;
    let out = await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    while (out.length > 180 * 1024 && quality > 40) {
      quality -= 10;
      out = await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    }
    return out;
  } catch (error) {
    throw new Error(
      `Rasmni Face ID formatiga o'girib bo'lmadi: ${error.message}. Boshqa aniq yuz rasmini JPEG qilib yuklang.`,
    );
  }
}

/**
 * Hikvision is picky about multipart layout. Build the exact byte layout
 * documented for FaceDataRecord / FDSetUp (FaceImage, not img).
 */
function buildHikvisionFaceMultipart(employeeNo, photoBuffer) {
  const meta = JSON.stringify({
    faceLibType: "blackFD",
    FDID: "1",
    FPID: employeeNo,
  });
  const boundary = `----hik${Date.now().toString(16)}`;
  const CRLF = "\r\n";
  const head =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceDataRecord"${CRLF}` +
    `Content-Type: application/json${CRLF}` +
    `${CRLF}` +
    meta +
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceImage"; filename="face.jpg"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}` +
    `${CRLF}`;
  const tail = `${CRLF}--${boundary}--${CRLF}`;
  const data = Buffer.concat([
    Buffer.from(head, "utf8"),
    photoBuffer,
    Buffer.from(tail, "utf8"),
  ]);

  return {
    data,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(data.length),
    },
  };
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
