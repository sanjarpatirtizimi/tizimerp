const fs = require("fs");
const path = require("path");
const axios = require("axios");

const AGENT_CODE_VERSION = "1.2.4";

const FILES = [
  "index.js",
  "prepare-face-jpeg.js",
  "hikvision-multipart.js",
  "acs-events.js",
  "sync-agent-files.js",
  "faceid-schedule.js",
  "digest-http-client.js",
  "acs-events.js",
];

function updateBases(apiBaseUrl) {
  const bases = [];
  if (apiBaseUrl) {
    bases.push(`${String(apiBaseUrl).replace(/\/$/, "")}/public/relay-agent`);
  }
  bases.push(
    "https://raw.githubusercontent.com/sanjarpatirtizimi/tizimerp/main/relay-agent",
  );
  return bases;
}

function versionFromSource(text) {
  const match = String(text).match(/AGENT_CODE_VERSION\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function cmpVersion(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

async function fetchText(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    responseType: "text",
    transformResponse: [(d) => d],
    validateStatus: (s) => s === 200,
  });
  return String(data);
}

/**
 * Pull newer agent files from the API (after Render deploy) or GitHub.
 * Returns { updated, remoteVersion } if index.js was replaced.
 */
async function syncAgentFiles(apiBaseUrl, log = console.log) {
  if (process.env.AGENT_NO_UPDATE === "true") {
    return { updated: false, remoteVersion: AGENT_CODE_VERSION };
  }

  let lastError = null;
  for (const base of updateBases(apiBaseUrl)) {
    try {
      const remoteIndex = await fetchText(`${base}/index.js`);
      const remoteVersion = versionFromSource(remoteIndex);
      if (!remoteVersion) continue;
      if (cmpVersion(remoteVersion, AGENT_CODE_VERSION) <= 0) {
        continue;
      }

      for (const file of FILES) {
        const body = file === "index.js" ? remoteIndex : await fetchText(`${base}/${file}`);
        if (!body || body.length < 50) continue;
        fs.writeFileSync(path.join(__dirname, file), body);
      }
      log(`Agent ${remoteVersion} yuklandi (${base}). Qayta ishga tushiriladi.`);
      return { updated: true, remoteVersion };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    log(`Agent yangilash o'tkazib yuborildi: ${lastError.message}`);
  }
  return { updated: false, remoteVersion: AGENT_CODE_VERSION };
}

function respawnSelf() {
  const { spawn } = require("child_process");
  const child = spawn(process.execPath, process.argv.slice(1), {
    cwd: process.cwd(),
    detached: true,
    stdio: "inherit",
    env: process.env,
  });
  child.unref();
  process.exit(0);
}

module.exports = {
  AGENT_CODE_VERSION,
  syncAgentFiles,
  respawnSelf,
};
