import { apiClient } from "../api-client";
import type { Driver, DriverStatus } from "../types";

export interface CreateDriverPayload {
  fullName: string;
  phone: string;
  password?: string;
  carPlate?: string;
  carBrand?: string;
  carModel?: string;
  deviceIds?: string[];
  photo?: File | null;
}

function toFormData(payload: CreateDriverPayload): FormData {
  const form = new FormData();
  form.append("fullName", payload.fullName);
  form.append("phone", payload.phone);
  if (payload.password) form.append("password", payload.password);
  if (payload.carPlate) form.append("carPlate", payload.carPlate);
  if (payload.carBrand) form.append("carBrand", payload.carBrand);
  if (payload.carModel) form.append("carModel", payload.carModel);
  if (payload.deviceIds?.length) form.append("deviceIds", JSON.stringify(payload.deviceIds));
  if (payload.photo) form.append("photo", payload.photo);
  return form;
}

export const driversApi = {
  list: (status?: DriverStatus) =>
    apiClient
      .get<Driver[]>("/drivers", { params: status ? { status } : undefined })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<Driver>(`/drivers/${id}`).then((r) => r.data),

  create: (payload: CreateDriverPayload) =>
    apiClient
      .post<Driver>("/drivers", toFormData(payload), {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  enroll: (id: string, deviceIds: string[], photo?: File) => {
    const form = new FormData();
    form.append("deviceIds", JSON.stringify(deviceIds));
    if (photo) form.append("photo", photo);
    return apiClient
      .post<Driver>(`/drivers/${id}/enroll`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  /** Re-queue face push using the driver's already-stored photo. */
  requeueEnrollment: (id: string, deviceIds: string[]) =>
    apiClient
      .post<Driver>(`/drivers/${id}/requeue-enrollment`, { deviceIds })
      .then((r) => r.data),

  /** Upload/replace face photo (stored durably in the database). */
  updatePhoto: (id: string, photo: File) => {
    const form = new FormData();
    form.append("photo", photo);
    return apiClient
      .post<Driver>(`/drivers/${id}/photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  update: (
    id: string,
    payload: {
      fullName?: string;
      phone?: string;
      password?: string;
      carPlate?: string;
      carBrand?: string;
      carModel?: string;
    },
  ) => apiClient.patch<Driver>(`/drivers/${id}`, payload).then((r) => r.data),

  setStatus: (id: string, status: DriverStatus) =>
    apiClient.patch<Driver>(`/drivers/${id}/status`, { status }).then((r) => r.data),

  setManualFaceMapping: (id: string, deviceId: string, hikvisionFaceId: string) =>
    apiClient
      .post<Driver>(`/drivers/${id}/manual-face-mapping`, { deviceId, hikvisionFaceId })
      .then((r) => r.data),

  startDevicePairing: (id: string, deviceId: string) =>
    apiClient
      .post<{
        deviceId: string;
        pairingExpiresAt: string | null;
        paired: boolean;
        hikvisionFaceId: string | null;
      }>(`/drivers/${id}/devices/${deviceId}/pairing`)
      .then((r) => r.data),

  cancelDevicePairing: (id: string, deviceId: string) =>
    apiClient
      .delete<Driver>(`/drivers/${id}/devices/${deviceId}/pairing`)
      .then((r) => r.data),

  unlinkDevice: (id: string, deviceId: string) =>
    apiClient.delete<Driver>(`/drivers/${id}/devices/${deviceId}`).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/drivers/${id}`).then((r) => r.data),
};
