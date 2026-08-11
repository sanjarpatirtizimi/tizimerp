"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Phone, Send } from "lucide-react";
import { adsApi } from "@/lib/api/ads";
import { mediaUrl } from "@/lib/media-url";
import type { DriverAd } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROTATE_MS = 4500;

function telegramHref(username: string): string {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

/**
 * Non-blocking top carousel. Images + captions rotate; app stays usable.
 */
export function DriverAdSlideshowBanner() {
  const [ad, setAd] = useState<DriverAd | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adsApi
      .getActiveForMe()
      .then((active) => {
        if (cancelled || !active?.slideshow) return;
        const slides = (active.slideshow.slides ?? []).filter((s) => s.imageUrl);
        if (slides.length < 2) return;
        setAd({ ...active.slideshow, slides });
        setIndex(0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = ad?.slides ?? [];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!ad || slides.length < 2) return null;

  const slide = slides[index] ?? slides[0];
  const title = slide.title || ad.title;
  const body = slide.body || ad.body;
  const image = mediaUrl(slide.imageUrl);

  const content = (
    <div className="relative overflow-hidden border-b border-[var(--border)] bg-[rgb(255_253_248)]">
      <div className="relative aspect-[21/9] max-h-40 w-full bg-muted sm:max-h-48">
        {slides.map((s, i) => {
          const src = mediaUrl(s.imageUrl);
          if (!src) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={src}
              alt=""
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-700",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-3 text-white">
          <p className="line-clamp-1 text-sm font-semibold drop-shadow">{title}</p>
          {body && (
            <p className="line-clamp-2 text-xs text-white/90 drop-shadow">
              {body}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-white/90">
            {ad.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" />
                {ad.phone}
              </span>
            )}
            {ad.telegramUsername && (
              <span className="inline-flex items-center gap-1">
                <Send className="size-3" />@{ad.telegramUsername}
              </span>
            )}
            {ad.linkUrl && (
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="size-3" />
                Link
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 py-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Slayd ${i + 1}`}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i === index ? "bg-primary" : "bg-muted-foreground/30",
            )}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    );
  }

  if (ad.telegramUsername) {
    return (
      <a
        href={telegramHref(ad.telegramUsername)}
        target="_blank"
        rel="noopener noreferrer"
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    );
  }

  if (ad.phone) {
    return (
      <a
        href={`tel:${ad.phone.replace(/[^\d+]/g, "")}`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    );
  }

  return content;
}
