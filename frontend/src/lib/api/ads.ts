import { apiClient } from "../api-client";
import type { Ad, DriverAd } from "../types";

export type CreateAdPayload = {
  title: string;
  body?: string;
  phone?: string;
  telegramUsername?: string;
  linkUrl?: string;
  startsAt: string;
  endsAt: string;
  audiencePercent?: number;
};

export const adsApi = {
  list: () => apiClient.get<Ad[]>("/ads").then((r) => r.data),

  create: (payload: CreateAdPayload) =>
    apiClient.post<Ad>("/ads", payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateAdPayload> & { isActive?: boolean }) =>
    apiClient.patch<Ad>(`/ads/${id}`, payload).then((r) => r.data),

  deactivate: (id: string) =>
    apiClient.patch<Ad>(`/ads/${id}/deactivate`).then((r) => r.data),

  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return apiClient
      .post<Ad>(`/ads/${id}/image`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  getActiveForMe: () =>
    apiClient.get<DriverAd | null>("/me/ads/active").then((r) => r.data),

  dismiss: (id: string) =>
    apiClient.post<{ ok: boolean }>(`/me/ads/${id}/dismiss`).then((r) => r.data),
};
