import { apiClient } from "../api-client";
import type { Driver } from "../types";

export const meApi = {
  getProfile: () => apiClient.get<Driver>("/me/profile").then((r) => r.data),
};
