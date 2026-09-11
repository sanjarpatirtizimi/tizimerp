'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Status
  getStatus: () => ipcRenderer.invoke('get-status'),
  getAgentDir: () => ipcRenderer.invoke('get-agent-dir'),
  getEnv: () => ipcRenderer.invoke('get-env'),

  // Controls
  start: () => ipcRenderer.send('start-agent'),
  stop: () => ipcRenderer.send('stop-agent'),
  restart: () => ipcRenderer.send('restart-agent'),

  // Settings
  saveEnv: (data) => ipcRenderer.send('save-env', data),
  pickAgentDir: () => ipcRenderer.invoke('pick-agent-dir'),
  pickNodePath: () => ipcRenderer.invoke('pick-node-path'),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
  openEnvFile: () => ipcRenderer.invoke('open-env-file'),

  // Events from main
  onStatus: (fn) => ipcRenderer.on('status', (_e, s) => fn(s)),
  onLog: (fn) => ipcRenderer.on('log', (_e, entry) => fn(entry)),
  onAgentDir: (fn) => ipcRenderer.on('agent-dir', (_e, dir) => fn(dir)),
  onEnvData: (fn) => ipcRenderer.on('env-data', (_e, data) => fn(data)),
  onEnvSaved: (fn) => ipcRenderer.on('env-saved', (_e, ok) => fn(ok)),
});
