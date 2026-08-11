import { apiClient } from "../api-client";
import type { Ad, AdKind, DriverActiveAds } from "../types";

export type CreateAdPayload = {
  kind?: AdKind;
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

  addSlide: (id: string, file: File, opts?: { title?: string; body?: string }) => {
    const form = new FormData();
    form.append("image", file);
    if (opts?.title) form.append("title", opts.title);
    if (opts?.body) form.append("body", opts.body);
    return apiClient
      .post<Ad>(`/ads/${id}/slides`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  getActiveForMe: () =>
    apiClient.get<DriverActiveAds>("/me/ads/active").then((r) => r.data),

  dismiss: (id: string) =>
    apiClient.post<{ ok: boolean }>(`/me/ads/${id}/dismiss`).then((r) => r.data),
};
