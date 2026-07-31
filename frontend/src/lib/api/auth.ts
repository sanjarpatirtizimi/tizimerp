import { apiClient } from "../api-client";
import type { TokenPair } from "../types";

export const authApi = {
  staffLogin: (phone: string, password: string) =>
    apiClient.post<TokenPair>("/auth/staff/login", { phone, password }).then((r) => r.data),

  driverPasswordLogin: (phone: string, password: string) =>
    apiClient.post<TokenPair>("/auth/driver/login", { phone, password }).then((r) => r.data),

  requestDriverOtp: (phone: string) =>
    apiClient.post<{ message: string }>("/auth/driver/otp/request", { phone }).then((r) => r.data),

  verifyDriverOtp: (phone: string, code: string) =>
    apiClient
      .post<TokenPair>("/auth/driver/otp/verify", { phone, code })
      .then((r) => r.data),

  logout: (refreshToken: string) => apiClient.post("/auth/logout", { refreshToken }),
};
