import { apiClient } from "../api-client";
import type { VisitEvent } from "../types";

export const visitsApi = {
  recent: (take = 50) =>
    apiClient
      .get<VisitEvent[]>("/visits/recent", { params: { take } })
      .then((r) => r.data),

  flagged: (take = 50) =>
    apiClient
      .get<VisitEvent[]>("/visits/flagged", { params: { take } })
      .then((r) => r.data),

  setFlag: (id: string, isRedFlagged: boolean, flagNote?: string) =>
    apiClient
      .patch<VisitEvent>(`/visits/${id}/flag`, { isRedFlagged, flagNote })
      .then((r) => r.data),
};
