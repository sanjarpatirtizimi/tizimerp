"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FacePhotoPickerProps = {
  previewUrl: string | null;
  onChange: (file: File | null) => void;
  hint?: string;
};

export function FacePhotoPicker({
  previewUrl,
  onChange,
  hint = "Kamerani bosing. Yuzingizni chiziq ichiga qo'ying.",
}: FacePhotoPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--brand-gold)] bg-muted text-muted-foreground"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-8" />
          )}
        </button>
        {previewUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
            Olib tashlash
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">{hint}</p>
      <button
        type="button"
        className="mx-auto block text-xs text-muted-foreground underline"
        onClick={() => fileInputRef.current?.click()}
      >
        Telefon xotirasidan rasm
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {cameraOpen && (
        <FaceCameraOverlay
          onCapture={(file) => {
            onChange(file);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

function FaceCameraOverlay({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 720 },
            height: { ideal: 960 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch {
        toast.error("Kameraga ruxsat bering yoki xotiradan rasm tanlang");
        onCloseRef.current();
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);
    try {
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 960;
      const targetRatio = 3 / 4;
      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      if (vw / vh > targetRatio) {
        sw = vh * targetRatio;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / targetRatio;
        sy = (vh - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 480, 640);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("blob");
      onCapture(new File([blob], "yuz.jpg", { type: "image/jpeg" }));
    } catch {
      toast.error("Rasm olinmadi. Qayta urinib ko'ring");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 46% 38% at 50% 42%, transparent 54%, rgb(0 0 0 / 0.62) 56%)",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[42%] h-[62vmin] w-[46vmin] max-h-[72%] max-w-[88%] -translate-x-1/2 -translate-y-1/2">
          <svg viewBox="0 0 200 260" className="h-full w-full">
            <ellipse
              cx="100"
              cy="118"
              rx="78"
              ry="102"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray="10 8"
            />
            <line
              x1="52"
              y1="100"
              x2="84"
              y2="100"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            />
            <line
              x1="116"
              y1="100"
              x2="148"
              y2="100"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M78 150 Q100 168 122 150"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.75"
            />
          </svg>
        </div>
        <p className="absolute inset-x-4 top-6 text-center text-base font-medium text-white drop-shadow">
          Yuzingizni chiziq ichiga qo&apos;ying
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 bg-black px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="secondary" onClick={onClose}>
          Orqaga
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!ready || busy}
          onClick={() => void takePhoto()}
          className={cn("min-w-36")}
        >
          Rasm olish
        </Button>
      </div>
    </div>
  );
}
