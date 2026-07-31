import { apiClient } from "../api-client";
import type { StaffUser, UserRole } from "../types";

export interface CreateStaffPayload {
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
}

export const usersApi = {
  list: () => apiClient.get<StaffUser[]>("/users").then((r) => r.data),
  create: (payload: CreateStaffPayload) =>
    apiClient.post<StaffUser>("/users", payload).then((r) => r.data),
  activate: (id: string) =>
    apiClient.patch<StaffUser>(`/users/${id}/activate`).then((r) => r.data),
  deactivate: (id: string) =>
    apiClient.patch<StaffUser>(`/users/${id}/deactivate`).then((r) => r.data),
};
