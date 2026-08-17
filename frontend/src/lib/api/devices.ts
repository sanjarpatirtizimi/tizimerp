import { apiClient } from "../api-client";
import type { Device } from "../types";

export interface CreateDevicePayload {
  name: string;
  /** Optional: only needed if this app should control the device via ISAPI. */
  ipAddress?: string;
  port?: number;
  username?: string;
  password?: string;
  location?: string;
}

export interface UpdateDevicePayload {
  name?: string;
  ipAddress?: string;
  port?: number;
  username?: string;
  /** Omit to keep the device's current password. */
  password?: string;
  location?: string;
}

export const devicesApi = {
  list: () => apiClient.get<Device[]>("/devices").then((r) => r.data),
  get: (id: string) => apiClient.get<Device>(`/devices/${id}`).then((r) => r.data),
  create: (payload: CreateDevicePayload) =>
    apiClient.post<Device>("/devices", payload).then((r) => r.data),
  update: (id: string, payload: UpdateDevicePayload) =>
    apiClient.patch<Device>(`/devices/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete<void>(`/devices/${id}`).then((r) => r.data),
  ping: (id: string) => apiClient.post<Device>(`/devices/${id}/ping`).then((r) => r.data),

  generateAgentKey: (id: string) =>
    apiClient
      .post<{ agentKey: string }>(`/devices/${id}/agent-key`)
      .then((r) => r.data),
  revokeAgentKey: (id: string) =>
    apiClient.delete<void>(`/devices/${id}/agent-key`).then((r) => r.data),

  clearEnrollmentQueue: () =>
    apiClient
      .post<{ clearedJobs: number; removedDrivers: number }>(
        "/devices/enrollment-queue/clear",
      )
      .then((r) => r.data),
};
