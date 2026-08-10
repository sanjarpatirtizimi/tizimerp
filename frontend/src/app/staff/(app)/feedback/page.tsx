"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-client";
import { feedbackApi } from "@/lib/api/feedback";
import { feedbackStatusLabels, formatDateTime } from "@/lib/format";
import type { DriverFeedback, FeedbackStatus } from "@/lib/types";

export default function StaffFeedbackPage() {
  const [items, setItems] = useState<DriverFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await feedbackApi.list();
      setItems(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Murojaatlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: FeedbackStatus) {
    try {
      const updated = await feedbackApi.update(id, { status });
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      toast.success("Holat yangilandi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Yangilab bo'lmadi"));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Murojaatlar</h1>
        <p className="text-sm text-muted-foreground">
          Haydovchilarning fikr va e&apos;tirozlari.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Hozircha murojaat yo&apos;q
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/staff/drivers/${item.driver.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.driver.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt)}
                    {item.driver.telegramUsername
                      ? ` · TG: ${item.driver.telegramUsername}`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline">
                  {feedbackStatusLabels[item.status]}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm">{item.body}</p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={item.status}
                  onValueChange={(v) => void setStatus(item.id, v as FeedbackStatus)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Yangi</SelectItem>
                    <SelectItem value="READ">Ko&apos;rilgan</SelectItem>
                    <SelectItem value="RESOLVED">Yechilgan</SelectItem>
                  </SelectContent>
                </Select>
                {item.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void setStatus(item.id, "READ")}
                  >
                    Ko&apos;rilgan qilish
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
