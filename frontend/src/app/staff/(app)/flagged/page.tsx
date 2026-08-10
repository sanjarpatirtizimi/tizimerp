"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { VisitList, VisitsLoading } from "@/components/visits/visit-list";
import { getApiErrorMessage } from "@/lib/api-client";
import { visitsApi } from "@/lib/api/visits";
import type { VisitEvent } from "@/lib/types";

export default function FlaggedVisitsPage() {
  const [visits, setVisits] = useState<VisitEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await visitsApi.flagged(80);
      setVisits(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Belgili kelishlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Qizil belgilar</h1>
        <p className="text-sm text-muted-foreground">
          Oxirgi kelishlarda qizil belgi qo&apos;yilgan pechatlar.
        </p>
      </div>
      {loading ? (
        <VisitsLoading />
      ) : (
        <VisitList
          visits={visits}
          onChanged={(updated) => {
            if (!updated.isRedFlagged) {
              setVisits((prev) => prev.filter((v) => v.id !== updated.id));
            } else {
              setVisits((prev) =>
                prev.map((v) => (v.id === updated.id ? updated : v)),
              );
            }
          }}
        />
      )}
    </div>
  );
}
