"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  ImagePlus,
  Phone,
  ExternalLink,
  Send,
  Images,
} from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-client";
import { adsApi } from "@/lib/api/ads";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media-url";
import type { Ad, AdKind } from "@/lib/types";

export default function AdsPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN"]}>
      <AdsPageContent />
    </RequireStaff>
  );
}

function fromLocalInputValue(local: string): string {
  return new Date(local).toISOString();
}

function AdsPageContent() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [kind, setKind] = useState<AdKind>("POPUP");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [audiencePercent, setAudiencePercent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [slideFiles, setSlideFiles] = useState<File[]>([]);

  function loadAds() {
    adsApi
      .list()
      .then(setAds)
      .catch((error) => toast.error(getApiErrorMessage(error)))
      .finally(() => setIsLoading(false));
  }

  useEffect(loadAds, []);

  function resetForm() {
    setKind("POPUP");
    setTitle("");
    setBody("");
    setPhone("");
    setTelegramUsername("");
    setLinkUrl("");
    setStartsAt("");
    setEndsAt("");
    setAudiencePercent("");
    setImageFile(null);
    setSlideFiles([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      toast.error("Boshlanish va tugash vaqtini kiriting");
      return;
    }
    if (kind === "SLIDESHOW" && slideFiles.length < 2) {
      toast.error("Slaydli reklama uchun kamida 2 ta rasm kerak");
      return;
    }
    const percent = audiencePercent.trim()
      ? Number(audiencePercent)
      : undefined;
    if (
      percent !== undefined &&
      (!Number.isInteger(percent) || percent < 1 || percent > 100)
    ) {
      toast.error("Foiz 1–100 oralig‘ida bo‘lishi kerak");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await adsApi.create({
        kind,
        title: title.trim(),
        body: body.trim() || undefined,
        phone: phone.trim() || undefined,
        telegramUsername: telegramUsername.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        startsAt: fromLocalInputValue(startsAt),
        endsAt: fromLocalInputValue(endsAt),
        audiencePercent: percent,
      });
      if (kind === "POPUP" && imageFile) {
        await adsApi.uploadImage(created.id, imageFile);
      }
      if (kind === "SLIDESHOW") {
        for (const file of slideFiles) {
          await adsApi.addSlide(created.id, file);
        }
      }
      toast.success("Reklama qo‘yildi");
      setOpen(false);
      resetForm();
      loadAds();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Reklama qo‘yib bo‘lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    try {
      await adsApi.deactivate(id);
      setAds((prev) =>
        prev.map((ad) => (ad.id === id ? { ...ad, isActive: false } : ad)),
      );
      toast.success("Reklama o‘chirildi");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleImageReplace(id: string, file: File | undefined) {
    if (!file) return;
    setUploadingId(id);
    try {
      const updated = await adsApi.uploadImage(id, file);
      setAds((prev) => prev.map((ad) => (ad.id === id ? { ...ad, ...updated } : ad)));
      toast.success("Rasm yangilandi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Rasm yuklab bo‘lmadi"));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleAddSlides(id: string, files: FileList | null) {
    if (!files?.length) return;
    setUploadingId(id);
    try {
      let updated: Ad | null = null;
      for (const file of Array.from(files)) {
        updated = await adsApi.addSlide(id, file);
      }
      if (updated) {
        setAds((prev) => prev.map((ad) => (ad.id === id ? { ...ad, ...updated } : ad)));
      }
      toast.success("Slayd(lar) qo‘shildi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Slayd yuklab bo‘lmadi"));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Reklamalar</h1>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus />
              Reklama qo‘yish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Yangi reklama</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Turi</Label>
                  <Select
                    value={kind}
                    onValueChange={(v) => setKind(v as AdKind)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POPUP">
                        Popup (ekranni to‘sadi, X bilan yopiladi)
                      </SelectItem>
                      <SelectItem value="SLIDESHOW">
                        Slayd (tepada aylanadi, to‘smaydi)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-title">Sarlavha</Label>
                  <Input
                    id="ad-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-body">Izoh / matn</Label>
                  <Textarea
                    id="ad-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    placeholder="Shafyorlarga ko‘rinadigan matn"
                  />
                </div>
                {kind === "POPUP" ? (
                  <div className="space-y-2">
                    <Label htmlFor="ad-image">Rasm</Label>
                    <Input
                      id="ad-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setImageFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ideal: 1080×1080 yoki 1080×720 px, JPG. Juda katta fayl
                      kerak emas (~500 KB).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="ad-slides">
                      Slayd rasmlari (kamida 2 ta)
                    </Label>
                    <Input
                      id="ad-slides"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) =>
                        setSlideFiles(Array.from(e.target.files ?? []))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Telefon uchun ideal:{" "}
                      <span className="font-medium text-foreground">
                        1080×608 px (16:9)
                      </span>
                      . Oddiy foto ham bo‘ladi — markazdan kesiladi. Har biri
                      ~300–700 KB.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tanlangan: {slideFiles.length} ta
                      {slideFiles.length > 0 && slideFiles.length < 2
                        ? " — yana rasm qo‘shing"
                        : ""}
                    </p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-phone">Telefon</Label>
                    <Input
                      id="ad-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-tg">Telegram</Label>
                    <Input
                      id="ad-tg"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-link">Havola (link)</Label>
                  <Input
                    id="ad-link"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-start">Qachondan</Label>
                    <Input
                      id="ad-start"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-end">Qachongacha</Label>
                    <Input
                      id="ad-end"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-percent">
                    Shafyorlar foizi (ixtiyoriy)
                  </Label>
                  <Input
                    id="ad-percent"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    placeholder="Masalan 30 — bo‘sh qoldirsangiz 100%"
                    value={audiencePercent}
                    onChange={(e) => setAudiencePercent(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Joylash
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : ads.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Hali reklama yo‘q.
        </p>
      ) : (
        <ul className="space-y-3">
          {ads.map((ad) => {
            const thumb =
              mediaUrl(ad.imageUrl) ||
              mediaUrl(ad.slides?.[0]?.imageUrl ?? null);
            const now = Date.now();
            const start = new Date(ad.startsAt).getTime();
            const end = new Date(ad.endsAt).getTime();
            const live = ad.isActive && start <= now && now < end;
            const slideCount = ad.slides?.length ?? 0;
            return (
              <li key={ad.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <Megaphone className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{ad.title}</p>
                          <Badge variant="secondary">
                            {ad.kind === "SLIDESHOW" ? "Slayd" : "Popup"}
                          </Badge>
                          {live ? (
                            <Badge className="bg-success/15 text-success">
                              Faol
                            </Badge>
                          ) : ad.isActive ? (
                            <Badge variant="secondary">
                              Kutilmoqda / tugagan
                            </Badge>
                          ) : (
                            <Badge variant="outline">O‘chirilgan</Badge>
                          )}
                        </div>
                        {ad.body && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {ad.body}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(ad.startsAt)} →{" "}
                          {formatDateTime(ad.endsAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Auditoriya: {ad.audiencePercent ?? 100}%
                          {ad.kind === "SLIDESHOW"
                            ? ` · slaydlar: ${slideCount}`
                            : typeof ad.dismissalsCount === "number"
                              ? ` · yopilgan: ${ad.dismissalsCount}`
                              : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                    <div className="flex flex-wrap gap-2">
                      {ad.kind === "POPUP" ? (
                        <label className="inline-flex cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              void handleImageReplace(
                                ad.id,
                                e.target.files?.[0],
                              );
                              e.target.value = "";
                            }}
                          />
                          <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent">
                            {uploadingId === ad.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ImagePlus className="size-4" />
                            )}
                            Rasm
                          </span>
                        </label>
                      ) : (
                        <label className="inline-flex cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              void handleAddSlides(ad.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent">
                            {uploadingId === ad.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Images className="size-4" />
                            )}
                            Slayd qo‘shish
                          </span>
                        </label>
                      )}
                      {ad.isActive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deactivatingId === ad.id}
                          onClick={() => handleDeactivate(ad.id)}
                        >
                          {deactivatingId === ad.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                          O‘chirish
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
