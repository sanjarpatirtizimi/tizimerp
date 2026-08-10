import { apiClient } from "../api-client";
import type { DriverFeedback, FeedbackStatus } from "../types";

export const feedbackApi = {
  list: (status?: FeedbackStatus) =>
    apiClient
      .get<DriverFeedback[]>("/feedback", {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),

  create: (body: string) =>
    apiClient.post<DriverFeedback>("/feedback", { body }).then((r) => r.data),

  update: (
    id: string,
    payload: { status?: FeedbackStatus; staffNote?: string },
  ) =>
    apiClient
      .patch<DriverFeedback>(`/feedback/${id}`, payload)
      .then((r) => r.data),
};
