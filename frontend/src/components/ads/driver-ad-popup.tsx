"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Phone, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { adsApi } from "@/lib/api/ads";
import { mediaUrl } from "@/lib/media-url";
import type { DriverAd } from "@/lib/types";

function telegramHref(username: string): string {
  const clean = username.replace(/^@/, "");
  return `https://t.me/${clean}`;
}

function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

/**
 * Shows the next active POPUP campaign when a driver opens the app.
 * Closing via X records dismissal so it won't return.
 */
export function DriverAdPopup() {
  const [ad, setAd] = useState<DriverAd | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adsApi
      .getActiveForMe()
      .then((active) => {
        if (cancelled || !active?.popup) return;
        setAd(active.popup);
        setOpen(true);
      })
      .catch(() => {
        // Silent — ads must not block the driver app.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    if (!ad) {
      setOpen(false);
      return;
    }
    const id = ad.id;
    setOpen(false);
    setAd(null);
    try {
      await adsApi.dismiss(id);
    } catch {
      // already closed locally
    }
  }

  const image = mediaUrl(ad?.imageUrl);

  return (
    <Dialog
      open={open && Boolean(ad)}
      onOpenChange={(next) => {
        if (!next) void dismiss();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-md">
        {ad && (
          <>
            {image && (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}
            <div className="space-y-4 p-6 pt-5">
              <DialogHeader>
                <DialogTitle className="text-left text-xl">
                  {ad.title}
                </DialogTitle>
                {ad.body && (
                  <DialogDescription className="text-left whitespace-pre-wrap text-sm text-foreground/80">
                    {ad.body}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="flex flex-col gap-2">
                {ad.phone && (
                  <Button variant="outline" className="justify-start" asChild>
                    <a href={phoneHref(ad.phone)}>
                      <Phone className="size-4" />
                      {ad.phone}
                    </a>
                  </Button>
                )}
                {ad.telegramUsername && (
                  <Button variant="outline" className="justify-start" asChild>
                    <a
                      href={telegramHref(ad.telegramUsername)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Send className="size-4" />@{ad.telegramUsername}
                    </a>
                  </Button>
                )}
                {ad.linkUrl && (
                  <Button className="justify-start" asChild>
                    <a
                      href={ad.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4" />
                      Havolani ochish
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
