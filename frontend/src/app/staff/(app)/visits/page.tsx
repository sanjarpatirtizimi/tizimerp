"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { VisitList, VisitsLoading } from "@/components/visits/visit-list";
import { getApiErrorMessage } from "@/lib/api-client";
import { visitsApi } from "@/lib/api/visits";
import type { VisitEvent } from "@/lib/types";

export default function VisitsPage() {
  const [visits, setVisits] = useState<VisitEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await visitsApi.recent(80);
      setVisits(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Kelishlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Oxirgi kelishlar</h1>
        <p className="text-sm text-muted-foreground">
          Eng so&apos;nggi pechatlar. Qizil bayroqcha — shu kelishni belgilash.
        </p>
      </div>
      {loading ? (
        <VisitsLoading />
      ) : (
        <VisitList
          visits={visits}
          onChanged={(updated) =>
            setVisits((prev) =>
              prev.map((v) => (v.id === updated.id ? updated : v)),
            )
          }
        />
      )}
    </div>
  );
}
