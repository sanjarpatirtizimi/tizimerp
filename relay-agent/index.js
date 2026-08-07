require("dotenv").config();
const axios = require("axios");
const FormData = require("form-data");
const { DigestHttpClient } = require("./digest-http-client");

const {
  API_BASE_URL,
  DEVICE_ID,
  AGENT_KEY,
  DEVICE_IP,
  DEVICE_PORT = "80",
  DEVICE_USERNAME,
  DEVICE_PASSWORD,
  POLL_INTERVAL_MS = "1500",
} = process.env;

function assertConfig() {
  const required = { API_BASE_URL, DEVICE_ID, AGENT_KEY, DEVICE_IP, DEVICE_USERNAME, DEVICE_PASSWORD };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.error(`.env faylida quyidagi qiymatlar to'ldirilmagan: ${missing.join(", ")}`);
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
    timeout: 15000,
  });
  const deviceClient = new DigestHttpClient(
    `http://${DEVICE_IP}:${DEVICE_PORT}`,
    DEVICE_USERNAME,
    DEVICE_PASSWORD,
  );

  log("Sanjar Patir relay agent ishga tushdi.");
  log(`Server: ${API_BASE_URL}`);
  log(`Qurilma: ${DEVICE_ID} (${DEVICE_IP}:${DEVICE_PORT})`);
  log(`Tekshirish oralig'i: ${POLL_INTERVAL_MS} ms`);
  console.log("");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollOnce(api, deviceClient, backendOrigin);
    } catch (error) {
      const message = error.response
        ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
        : error.message;
      log(`Serverdan so'rov xatosi: ${message}`);
    }
    await sleep(Number(POLL_INTERVAL_MS));
  }
}

async function pollOnce(api, deviceClient, backendOrigin) {
  const { data: jobs } = await api.get(`/agent/${DEVICE_ID}/pending`);
  if (!Array.isArray(jobs) || jobs.length === 0) return;

  log(`${jobs.length} ta yangi haydovchi topildi.`);

  for (const job of jobs) {
    try {
      if (!job.photoUrl) throw new Error("Haydovchida rasm yo'q");

      const photoResponse = await axios.get(`${backendOrigin}${job.photoUrl}`, {
        responseType: "arraybuffer",
      });
      const photoBuffer = Buffer.from(photoResponse.data);

      await enrollOnDevice(deviceClient, job.driverId, job.fullName, photoBuffer);

      await api.post(`/agent/${DEVICE_ID}/pending/${job.registrationId}/ack`, {
        success: true,
        hikvisionFaceId: job.driverId,
      });
      log(`  \u2714 ${job.fullName} qurilmaga muvaffaqiyatli yozildi.`);
    } catch (error) {
      const message = error.response
        ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data)}`
        : error.message;
      log(`  \u2718 ${job.fullName}: ${message}`);
      await api
        .post(`/agent/${DEVICE_ID}/pending/${job.registrationId}/ack`, {
          success: false,
          error: message,
        })
        .catch(() => undefined);
    }
  }
}

/** Same two-step ISAPI flow as the backend's `HikvisionService.enrollDriver`. */
async function enrollOnDevice(deviceClient, driverId, fullName, photoBuffer) {
  const userInfoResponse = await deviceClient.put(
    "/ISAPI/AccessControl/UserInfo/Record?format=json",
    {
      data: {
        UserInfo: {
          employeeNo: driverId,
          name: fullName,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: "2020-01-01T00:00:00",
            endTime: "2037-12-31T23:59:59",
            timeType: "local",
          },
        },
      },
      headers: { "Content-Type": "application/json" },
    },
  );
  if (userInfoResponse.status >= 400) {
    throw new Error(
      `UserInfo/Record: HTTP ${userInfoResponse.status} ${JSON.stringify(userInfoResponse.data)}`,
    );
  }

  const form = new FormData();
  form.append(
    "FaceDataRecord",
    JSON.stringify({ faceLibType: "blackFD", FDID: "1", FPID: driverId }),
    { contentType: "application/json" },
  );
  form.append("img", photoBuffer, { filename: "face.jpg", contentType: "image/jpeg" });

  const faceResponse = await deviceClient.post(
    "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
    { data: form, headers: form.getHeaders() },
  );
  if (faceResponse.status >= 400) {
    throw new Error(
      `FDLib/FDSetUp: HTTP ${faceResponse.status} ${JSON.stringify(faceResponse.data)}`,
    );
  }
}

main();
