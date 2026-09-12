import { apiClient } from "../api-client";

export interface AgentInfo {
  id: string;
  name: string;
  location: string | null;
  deviceStatus: string;
  agentVersion: string | null;
  agentLastSeenAt: string | null;
  agentKeyCreatedAt: string | null;
  agentConfig: AgentConfig | null;
  lastLog: { message: string; level: string; createdAt: string } | null;
  isOnline: boolean;
}

export interface AgentLog {
  id: string;
  level: string;
  message: string;
  raw: string | null;
  createdAt: string;
}

export interface AgentConfig {
  pollIntervalMs?: number;
  stampPollEnabled?: boolean;
  stampIntervalMs?: number;
}

export const relayAgentsApi = {
  list: () => apiClient.get<AgentInfo[]>("/staff/relay-agents").then((r) => r.data),

  getLogs: (deviceId: string, limit = 100) =>
    apiClient
      .get<AgentLog[]>(`/staff/relay-agents/${deviceId}/logs`, { params: { limit } })
      .then((r) => r.data),

  clearLogs: (deviceId: string) =>
    apiClient.delete<{ cleared: number }>(`/staff/relay-agents/${deviceId}/logs`).then((r) => r.data),

  getConfig: (deviceId: string) =>
    apiClient.get<AgentConfig | null>(`/staff/relay-agents/${deviceId}/config`).then((r) => r.data),

  setConfig: (deviceId: string, config: AgentConfig) =>
    apiClient
      .put<{ ok: boolean; config: AgentConfig }>(`/staff/relay-agents/${deviceId}/config`, config)
      .then((r) => r.data),
};
