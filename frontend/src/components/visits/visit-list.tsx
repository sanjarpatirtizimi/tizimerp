"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [flagOpen, setFlagOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function clearFlag() {
    setSaving(true);
    try {
      const updated = await visitsApi.setFlag(visit.id, false);
      onChanged(updated);
      toast.success("Belgi olib tashlandi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Belgini o'zgartirib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmFlag() {
    const trimmed = note.trim();
    if (trimmed.length < 2) {
      toast.error("Izoh majburiy — kamida 2 belgi yozing");
      return;
    }
    setSaving(true);
    try {
      const updated = await visitsApi.setFlag(visit.id, true, trimmed);
      onChanged(updated);
      setFlagOpen(false);
      setNote("");
      toast.success("Qizil belgi qo'yildi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Belgini o'zgartirib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  function onFlagClick() {
    if (visit.isRedFlagged) {
      void clearFlag();
      return;
    }
    setNote("");
    setFlagOpen(true);
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
            <p className="text-xs text-destructive">Izoh: {visit.flagNote}</p>
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={saving}
          className={cn(
            visit.isRedFlagged
              ? "text-destructive hover:text-destructive"
              : "text-muted-foreground",
          )}
          onClick={onFlagClick}
          aria-label={
            visit.isRedFlagged ? "Belgini olib tashlash" : "Qizil belgi"
          }
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Flag
              className={cn("size-4", visit.isRedFlagged && "fill-current")}
            />
          )}
        </Button>
      </div>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qizil belgi</DialogTitle>
            <DialogDescription>
              Izoh majburiy. Nima uchun bu kelish shubhali ekanini yozing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`flag-note-${visit.id}`}>Izoh</Label>
            <Textarea
              id={`flag-note-${visit.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: bir necha marta ketma-ket pechat..."
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFlagOpen(false)}
              disabled={saving}
            >
              Bekor
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmFlag()}
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              Belgilash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
