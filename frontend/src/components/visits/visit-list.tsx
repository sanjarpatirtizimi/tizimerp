"use client";

import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage } from "@/lib/api-client";
import { visitsApi } from "@/lib/api/visits";
import { formatDateTime, formatUzs, visitStatusLabels } from "@/lib/format";
import type { VisitEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VisitList({
  visits,
  onChanged,
}: {
  visits: VisitEvent[];
  onChanged: (visit: VisitEvent) => void;
}) {
  if (visits.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Hozircha kelish yo&apos;q
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {visits.map((visit) => (
        <VisitRow key={visit.id} visit={visit} onChanged={onChanged} />
      ))}
    </ul>
  );
}

function VisitRow({
  visit,
  onChanged,
}: {
  visit: VisitEvent;
  onChanged: (visit: VisitEvent) => void;
}) {
  async function toggleFlag() {
    try {
      const updated = await visitsApi.setFlag(visit.id, !visit.isRedFlagged);
      onChanged(updated);
      toast.success(
        updated.isRedFlagged ? "Qizil belgi qo'yildi" : "Belgi olib tashlandi",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Belgini o'zgartirib bo'lmadi"));
    }
  }

  const when = visit.eventDateTime || visit.createdAt;
  const stampAmount = visit.transaction?.amount;

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {visit.driver ? (
              <Link
                href={`/staff/drivers/${visit.driver.id}`}
                className="truncate font-medium hover:underline"
              >
                {visit.driver.fullName}
              </Link>
            ) : (
              <span className="font-medium text-muted-foreground">
                Noma&apos;lum haydovchi
              </span>
            )}
            <Badge variant="outline" className="text-[10px]">
              {visitStatusLabels[visit.status] ?? visit.status}
            </Badge>
            {visit.isRedFlagged && (
              <Badge variant="destructive" className="text-[10px]">
                Qizil
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(when)}
            {" · "}
            {visit.device.name}
            {stampAmount != null && (
              <>
                {" · "}
                {formatUzs(stampAmount)}
              </>
            )}
          </p>
          {visit.driver?.telegramUsername && (
            <p className="text-xs text-muted-foreground">
              TG: {visit.driver.telegramUsername}
            </p>
          )}
          {visit.flagNote && (
            <p className="text-xs text-destructive">{visit.flagNote}</p>
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn(
            visit.isRedFlagged
              ? "text-destructive hover:text-destructive"
              : "text-muted-foreground",
          )}
          onClick={() => void toggleFlag()}
          aria-label={visit.isRedFlagged ? "Belgini olib tashlash" : "Qizil belgi"}
        >
          <Flag className={cn("size-4", visit.isRedFlagged && "fill-current")} />
        </Button>
      </div>
    </li>
  );
}

export function VisitsLoading() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
