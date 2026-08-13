import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearStoredSession, getStoredSession, setStoredSession } from "./auth-storage";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export const apiClient = axios.create({
  baseURL: API_URL,
  // Prevent infinite spinners when the API stalls (e.g. concurrent enroll).
  timeout: 45_000,
});

/** Separate, interceptor-free instance for the refresh call itself (avoids recursive 401 handling). */
const refreshClient = axios.create({ baseURL: API_URL, timeout: 30_000 });

apiClient.interceptors.request.use((config) => {
  const session = getStoredSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

/** Called by the AuthProvider so we can redirect to the right login page on hard logout. */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

async function refreshAccessToken(): Promise<string> {
  const session = getStoredSession();
  if (!session?.refreshToken) throw new Error("No refresh token available");

  const { data } = await refreshClient.post<{ accessToken: string; refreshToken: string }>(
    "/auth/refresh",
    { refreshToken: session.refreshToken },
  );
  setStoredSession(data);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      throw error;
    }

    // Don't try to "refresh" the refresh call itself.
    if (originalRequest.url?.includes("/auth/refresh")) {
      clearStoredSession();
      onSessionExpired?.();
      throw error;
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearStoredSession();
      onSessionExpired?.();
      throw refreshError;
    }
  },
);

export interface ApiErrorBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export function getApiErrorMessage(error: unknown, fallback = "Xatolik yuz berdi"): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(", ") : body.message;
    }
  }
  return fallback;
}
