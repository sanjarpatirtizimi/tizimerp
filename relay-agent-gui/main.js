'use strict';

const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
} = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// ─── Agent papkasini topish ────────────────────────────────────────────────
// GUI relay-agent papkasining ichida (relay-agent/gui/) yoki
// qo'shni papkada (relay-agent/ bilan bir joyda) bo'lishi mumkin.
function findAgentDir() {
  const candidates = [
    // GUI relay-agent ichida: relay-agent/gui/ → relay-agent/
    path.join(app.getAppPath(), '..'),
    // Standalone exe holati: exe yonidagi relay-agent/
    path.join(path.dirname(app.getPath('exe')), 'relay-agent'),
    // Development: workspace/relay-agent-gui → workspace/relay-agent
    path.join(app.getAppPath(), '..', 'relay-agent'),
    // Same dir as exe
    path.dirname(app.getPath('exe')),
  ];

  // Saqlangan yo'lni tekshirish
  const saved = loadSetting('agentDir');
  if (saved && fs.existsSync(path.join(saved, 'index.js'))) return saved;

  // node_modules bor papkani ustun ko'rish
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.js')) &&
        fs.existsSync(path.join(dir, 'node_modules'))) return dir;
  }
  // node_modules yo'q bo'lsa ham index.js ni topish (keyin xabar beramiz)
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.js'))) return dir;
  }
  return null;
}

// ─── Node.js yo'lini topish ────────────────────────────────────────────────
function findNodePath() {
  const saved = loadSetting('nodePath');
  if (saved && fs.existsSync(saved)) return saved;

  try {
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    const result = execSync(cmd, { encoding: 'utf8', timeout: 3000 });
    const lines = result.trim().split('\n');
    const nodePath = lines.find(l => l.includes('node') && !l.includes('node_modules'));
    if (nodePath && fs.existsSync(nodePath.trim())) return nodePath.trim();
  } catch {
    // Qo'lda sozlash kerak
  }

  // Windows standart o'rnatish joylarini tekshirish
  const winPaths = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    path.join(os.homedir(), 'AppData', 'Roaming', 'nvm', 'current', 'node.exe'),
  ];
  for (const p of winPaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'node'; // PATH dan topishga urinish
}

// ─── .env o'qish/yozish ────────────────────────────────────────────────────
function readEnv(agentDir) {
  const envPath = path.join(agentDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const result = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    result[key] = val;
  }
  return result;
}

function writeEnv(agentDir, data) {
  const envPath = path.join(agentDir, '.env');
  let raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  const updatedKeys = new Set();

  // Mavjud qatorlarni yangilash
  const lines = raw.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (key in data) {
      updatedKeys.add(key);
      return `${key}=${data[key]}`;
    }
    return line;
  });

  // Yangi kalitlarni qo'shish
  for (const [key, val] of Object.entries(data)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// ─── App sozlamalarini saqlash ──────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch { return {}; }
}
function loadSetting(key) { return loadSettings()[key]; }
function saveSetting(key, val) {
  const s = loadSettings();
  s[key] = val;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

// ─── Log soddalash ─────────────────────────────────────────────────────────
function simplifyLog(raw) {
  const text = raw.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '').trim();

  // Stack trace qatorlarini yashirish (foydasiz texnik info)
  if (/^\s*at\s+\S+\s+\(/.test(text) || /^\s*at\s+\S+:\d+:\d+/.test(text))
    return null; // null = bu qatorni ko'rsatma

  if (/^Require stack:?$/i.test(text) || /^-\s+[A-Z]:\\.+\.js$/.test(text))
    return null;

  if (/Cannot find module\s+'([^']+)'/i.test(text)) {
    const m = text.match(/Cannot find module\s+'([^']+)'/i);
    const mod = m ? m[1] : 'modul';
    return { msg: `\u274C npm paketi topilmadi: "${mod}" — relay-agent papkasida "npm install" bajaring`, level: 'error' };
  }

  if (/MODULE_NOT_FOUND/i.test(text))
    return null; // "Cannot find module" bilan birgalikda keladi, takrorlanmasin

  if (/^Error:\s*/i.test(text) && !/Cannot find/i.test(text)) {
    const msg = text.replace(/^Error:\s*/i, '').slice(0, 120);
    return { msg: `\u274C Xato: ${msg}`, level: 'error' };
  }

  if (/relay agent ishga tushdi/i.test(text))
    return { msg: '\u{1F680} Relay agent ishga tushdi', level: 'info' };

  if (/Versiya\s+([\d.]+)/i.test(text)) {
    const m = text.match(/Versiya\s+([\d.]+)/i);
    return { msg: `\u2139\uFE0F Versiya: ${m[1]}`, level: 'info' };
  }

  if (/Server ulandi|Server qurilmani tanidi/i.test(text))
    return { msg: '\u{1F517} Server bilan ulanish o\'rnatildi', level: 'info' };

  if (/Server:.*http|Qurilma.*\.env/i.test(text))
    return { msg: '\u2139\uFE0F Sozlamalar yuklandi', level: 'info' };

  if (/Haydovchi qo.*shilsa|Oynani yopmang/i.test(text))
    return { msg: '\u{1F40C} Tayyor — yangi haydovchi kutilmoqda', level: 'info' };

  if (/Pechat poll.*o.chirilgan/i.test(text))
    return { msg: '\u2139\uFE0F Pechat o\'qish o\'chirilgan', level: 'info' };

  if (/Pechat oralig|Pechat poll/i.test(text))
    return { msg: '\u2139\uFE0F Pechat o\'qish yoqilgan', level: 'info' };

  if (/\u2713.*yozildi|yozildi.*Person ID/i.test(text)) {
    const m = text.match(/\u2713\s*(.+?)\s+yozildi/i);
    const name = m ? m[1].trim() : 'Haydovchi';
    return { msg: `\u2705 "${name}" Face ID ga yozildi`, level: 'info' };
  }

  if (/yangi haydovchi:/i.test(text)) {
    const m = text.match(/yangi haydovchi:\s*(.+)/i);
    const name = m ? m[1].trim() : '';
    return { msg: `\u{1F464} Yangi haydovchi: ${name || 'yozilmoqda'}`, level: 'info' };
  }

  if (/haydovchi navbatda.*hozir/i.test(text)) {
    const nm = text.match(/hozir\s+(.+?),/i);
    const cm = text.match(/(\d+)\s*ta.*navbatda/i);
    const name = nm ? nm[1].trim() : '';
    const count = cm ? cm[1] : '?';
    return {
      msg: name ? `\u{1F464} ${count} ta navbatda — hozir: ${name}` : `\u{1F464} ${count} ta haydovchi navbatda`,
      level: 'info',
    };
  }

  if (/rasm:.*KB.*\u2192/i.test(text))
    return { msg: '\u{1F4F7} Rasm tayyorlandi', level: 'info' };

  if (/ishlayapti.*yuz yozilmoqda/i.test(text)) {
    const m = text.match(/navbat[:\s]+(\d+)/i);
    return { msg: `\u23F3 ${m ? m[1] : '?'} ta yozilmoqda`, level: 'info' };
  }

  if (/ishlayapti.*Face ID so.ralmoqda/i.test(text)) {
    const m = text.match(/\((\d+) marta OK\)/);
    return {
      msg: m ? `\u2705 Ishlayapti — ${m[1]} marta OK` : '\u2705 Ishlayapti',
      level: 'info',
    };
  }

  if (/ishlayapti.*oxirgi xato/i.test(text))
    return { msg: '\u26A0\uFE0F Ishlayapti, lekin xato bor', level: 'warn' };

  if (/ishlayapti/i.test(text) && !/xato/i.test(text))
    return { msg: '\u2705 Ishlayapti', level: 'info' };

  if (/navbat bo.sh/i.test(text))
    return { msg: '\u{1F634} Navbat bo\'sh — yangi haydovchi kutilmoqda', level: 'info' };

  if (/navbat noldan|navbat tozalandi/i.test(text)) {
    const m = text.match(/(\d+) ta yuz yuklash/i);
    return { msg: `\u{1F5D1}\uFE0F Navbat tozalandi${m ? ` (${m[1]} ta)` : ''}`, level: 'info' };
  }

  if (/navbat katta/i.test(text)) {
    const m = text.match(/(\d+) ta/i);
    return { msg: `\u26A0\uFE0F Navbat to\'lib ketdi${m ? ` (${m[1]} ta)` : ''}`, level: 'warn' };
  }

  // ─── ACS Event (face scan) log messages ────────────────────────────
  if (/AcsEvent:.*ta YANGI yuz/i.test(text)) {
    const m = text.match(/(\d+)\s*ta YANGI yuz/i);
    const total = text.match(/\((\d+)\s*jami/i);
    const n = m ? m[1] : '?';
    const t = total ? total[1] : '';
    return {
      msg: '\u{1F6B6} ' + n + " ta odam yuzini ko\u02BBrsatdi" + (t ? ' (' + t + ' ta oynada)' : ''),
      level: 'info',
    };
  }

  if (/\u2713\s*pechat:.*Person ID/i.test(text)) {
    const m = text.match(/Person ID\s*(\S+)\s*\(([^)]*)\)/i);
    const name = m ? m[2].trim() : '';
    const pid = m ? m[1] : '';
    return {
      msg: '\u{1F3AB} Pechat berildi' + (name ? ': ' + name : '') + ' (ID: ' + pid + ')',
      level: 'info',
    };
  }

  if (/takroriy.*e.tiborsiz|duplicate.*serial/i.test(text))
    return { msg: '\u{1F504} Takroriy pechat — e\'tiborsiz (bir xil signal)', level: 'info' };

  if (/kutish.*Person ID.*pechat yaqinda/i.test(text)) {
    const wait = text.match(/~([^\s,]+(?:\s+(?:soat|daqiqa|s))?)/);
    return {
      msg: '\u23F3 Bu odam yaqinda kelgan — ' + (wait ? wait[1] : '?') + ' kutish kerak',
      level: 'info',
    };
  }

  if (/YANGI serial yo.q.*pechat yuborilmaydi/i.test(text) || /qurilma yuzni ko.rsatishi mumkin/i.test(text))
    return { msg: '\u{1F441}\uFE0F Yuz ko\u02BBrindi, lekin yangi signal yo\u02BBq — Face ID sozlash kerak', level: 'warn' };

  if (/Pechat navbatini serverga yuborib bo.lmadi/i.test(text))
    return { msg: '\u{1F310} Pechat serverga yuborilmadi — qayta urinadi', level: 'warn' };

  if (/Face ID javob bermadi|ECONNREFUSED/i.test(text))
    return { msg: '\u{1F534} Face ID javob bermayapti — ulanishni tekshiring', level: 'error' };

  if (/AcsEvent.*xatosi|pechat xatosi/i.test(text)) {
    const wm = text.match(/(\d+)s dam/);
    return { msg: `\u26A0\uFE0F Pechat xatosi${wm ? ` — ${wm[1]}s dam` : ''}`, level: 'warn' };
  }

  if (/server.*javob bermadi|Render.*javob/i.test(text)) {
    const wm = text.match(/(\d+)s/);
    return { msg: `\u{1F310} Server javob bermadi${wm ? ` (${wm[1]}s keyin)` : ''}`, level: 'warn' };
  }

  if (/timeout.*ms exceeded/i.test(text))
    return { msg: '\u23F1\uFE0F Qurilma sekin javob berdi', level: 'warn' };

  if (/ECONNRESET|ECONNABORTED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(text))
    return { msg: '\u{1F310} Tarmoq uzildi — qayta urinadi', level: 'warn' };

  if (/PicFeaturePoints|SubpicAnalysisModelingError/i.test(text))
    return { msg: '\u{1F4F7} Rasm sifati yetarli emas — aniq yuz rasmini yuklang', level: 'error' };

  if (/AGENT_KEY noto.g.ri|HTTP 401|HTTP 403/i.test(text))
    return { msg: '\u{1F511} Noto\'g\'ri kalit — Agent kalitini yangilang', level: 'error' };

  if (/\u2717.*:|xatosi:/i.test(text)) {
    const m = text.match(/\u2717\s*(.+?):/i);
    const name = m ? m[1].trim() : 'Haydovchi';
    return { msg: `\u274C "${name}" yozishda xato`, level: 'error' };
  }

  if (/ro.yxatga olish.*server band/i.test(text))
    return { msg: '\u{1F310} Server band — qayta uriniladi', level: 'warn' };

  if (/xato|error|fail/i.test(text))
    return { msg: `\u274C ${text.slice(0, 100)}`, level: 'error' };

  if (/ogohlantirish|warn|band/i.test(text))
    return { msg: `\u26A0\uFE0F ${text.slice(0, 100)}`, level: 'warn' };

  return { msg: `\u2139\uFE0F ${text.slice(0, 100)}`, level: 'info' };
}

// ─── Global holat ──────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let agentProcess = null;
let agentDir = null;
let nodePath = 'node';
let isQuitting = false;

function getStatus() {
  return agentProcess && !agentProcess.killed ? 'running' : 'stopped';
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── Agent boshqaruvi ──────────────────────────────────────────────────────
function startAgent() {
  if (agentProcess && !agentProcess.killed) return;
  if (!agentDir) {
    sendToRenderer('log', {
      msg: '\u274C Agent papkasi topilmadi — Sozlamalar → Papkani tanlash',
      level: 'error',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
    return;
  }

  const indexPath = path.join(agentDir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    sendToRenderer('log', {
      msg: `\u274C index.js topilmadi: ${indexPath}`,
      level: 'error',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
    return;
  }

  // node_modules tekshirish
  const nmPath = path.join(agentDir, 'node_modules');
  if (!fs.existsSync(nmPath)) {
    sendToRenderer('log', {
      msg: '\u274C npm paketlari o\'rnatilmagan!',
      level: 'error',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
    sendToRenderer('log', {
      msg: `\u{1F4CB} Buyruq: CMD ni oching \u2192 "${agentDir}" papkasiga kiring \u2192 "npm install" bajaring`,
      level: 'warn',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
    return;
  }

  // .env tekshirish
  const envPath = path.join(agentDir, '.env');
  if (!fs.existsSync(envPath)) {
    sendToRenderer('log', {
      msg: '\u26A0\uFE0F .env fayli topilmadi — Sozlamalar tabiga o\'ting va to\'ldiring',
      level: 'warn',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
  } else {
    const env = readEnv(agentDir);
    if (!env.AGENT_KEY || !env.DEVICE_IP) {
      sendToRenderer('log', {
        msg: '\u26A0\uFE0F AGENT_KEY yoki DEVICE_IP sozlanmagan — Sozlamalar tabiga o\'ting',
        level: 'warn',
        time: new Date().toLocaleTimeString('uz-UZ'),
      });
    }
  }

  sendToRenderer('log', {
    msg: '\u{1F680} Agent ishga tushirilmoqda...',
    level: 'info',
    time: new Date().toLocaleTimeString('uz-UZ'),
  });

  try {
    agentProcess = spawn(nodePath, ['index.js'], {
      cwd: agentDir,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
  } catch (err) {
    sendToRenderer('log', {
      msg: `\u274C Node.js ishga tushirib bo\'lmadi: ${err.message}`,
      level: 'error',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
    sendToRenderer('status', 'stopped');
    updateTray();
    return;
  }

  sendToRenderer('status', 'running');
  updateTray();

  function onData(data) {
    const lines = String(data).split('\n');
    for (const line of lines) {
      const raw = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
      if (!raw) continue;
      const result = simplifyLog(raw);
      if (!result) continue; // null = stack trace qatori, yashirildi
      sendToRenderer('log', {
        msg: result.msg,
        level: result.level,
        raw,
        time: new Date().toLocaleTimeString('uz-UZ'),
      });
    }
  }

  agentProcess.stdout.on('data', onData);
  agentProcess.stderr.on('data', onData);

  agentProcess.on('exit', (code) => {
    agentProcess = null;
    sendToRenderer('status', 'stopped');
    updateTray();
    if (!isQuitting) {
      const msg = code === 0
        ? '\u23F9\uFE0F Agent to\'xtatildi'
        : `\u{1F534} Agent to\'xtadi (kod: ${code}) — Qayta ishga tushirish uchun START bosing`;
      sendToRenderer('log', {
        msg,
        level: code === 0 ? 'info' : 'error',
        time: new Date().toLocaleTimeString('uz-UZ'),
      });
    }
  });

  agentProcess.on('error', (err) => {
    sendToRenderer('log', {
      msg: `\u274C Process xatosi: ${err.message}`,
      level: 'error',
      time: new Date().toLocaleTimeString('uz-UZ'),
    });
  });
}

function stopAgent() {
  if (!agentProcess || agentProcess.killed) return;
  agentProcess.kill('SIGTERM');
  setTimeout(() => {
    if (agentProcess && !agentProcess.killed) agentProcess.kill('SIGKILL');
  }, 3000);
}

function restartAgent() {
  stopAgent();
  setTimeout(startAgent, 1500);
}

// ─── Tray ─────────────────────────────────────────────────────────────────
function updateTray() {
  if (!tray) return;
  const running = getStatus() === 'running';
  tray.setToolTip(`Sanjar Patir Agent — ${running ? 'Ishlayapti \u2705' : 'To\'xtatilgan \u{1F534}'}`);

  const menu = Menu.buildFromTemplate([
    {
      label: `Holat: ${running ? '\u2705 Ishlayapti' : '\u{1F534} To\'xtatilgan'}`,
      enabled: false,
    },
    { type: 'separator' },
    { label: '\u{1F7E2} Ishga tushirish', click: startAgent, enabled: !running },
    { label: '\u{1F534} To\'xtatish', click: stopAgent, enabled: running },
    { label: '\u{1F504} Qayta ishga tushirish', click: restartAgent },
    { type: 'separator' },
    { label: '\u{1F4CB} Panelni ochish', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Chiqish', click: () => { isQuitting = true; stopAgent(); app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ─── Main window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 640,
    minHeight: 480,
    title: 'Sanjar Patir — Relay Agent',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1a1208',
    show: false,
    frame: true,
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Dastlabki holat yuborish
    sendToRenderer('status', getStatus());
    sendToRenderer('agent-dir', agentDir);
    if (agentDir) {
      const env = readEnv(agentDir);
      sendToRenderer('env-data', env);
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── IPC handlers ────────────────────────────────────────────────────────────
ipcMain.handle('get-status', () => getStatus());
ipcMain.handle('get-agent-dir', () => agentDir);
ipcMain.handle('get-env', () => agentDir ? readEnv(agentDir) : {});

ipcMain.on('start-agent', () => startAgent());
ipcMain.on('stop-agent', () => stopAgent());
ipcMain.on('restart-agent', () => restartAgent());

ipcMain.on('save-env', (_e, data) => {
  if (!agentDir) return;
  writeEnv(agentDir, data);
  sendToRenderer('env-saved', true);
});

ipcMain.handle('pick-agent-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'relay-agent papkasini tanlang',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const dir = result.filePaths[0];
  if (!fs.existsSync(path.join(dir, 'index.js'))) {
    dialog.showErrorBox(
      'Noto\'g\'ri papka',
      'Tanlangan papkada index.js topilmadi.\nrelay-agent papkasini tanlang.',
    );
    return null;
  }
  agentDir = dir;
  saveSetting('agentDir', dir);
  sendToRenderer('agent-dir', dir);
  const env = readEnv(dir);
  sendToRenderer('env-data', env);
  return dir;
});

ipcMain.handle('pick-node-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'node.exe faylini tanlang',
    filters: [{ name: 'Node.js', extensions: ['exe', ''] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  nodePath = result.filePaths[0];
  saveSetting('nodePath', nodePath);
  return nodePath;
});

ipcMain.handle('open-log-folder', () => {
  if (agentDir) shell.openPath(agentDir);
});

ipcMain.handle('open-env-file', () => {
  if (agentDir) shell.openPath(path.join(agentDir, '.env'));
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  agentDir = findAgentDir();
  nodePath = findNodePath();

  // Tray
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  updateTray();

  createWindow();

  // Agent papkasi topilsa avtomatik ishga tushirish
  if (agentDir) {
    const env = readEnv(agentDir);
    if (env.API_BASE_URL && env.AGENT_KEY && env.DEVICE_IP) {
      setTimeout(startAgent, 1000);
    }
  }
});

app.on('window-all-closed', () => {
  // macOS da tray ishlashi uchun app ni yopmang
  if (process.platform !== 'darwin') {
    // Faqat tray orqali chiqish mumkin
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopAgent();
});
