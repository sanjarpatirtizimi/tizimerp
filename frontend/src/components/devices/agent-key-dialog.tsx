"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { API_URL, getApiErrorMessage } from "@/lib/api-client";
import { devicesApi } from "@/lib/api/devices";
import type { Device } from "@/lib/types";

/**
 * Issues (or re-issues) the API key a local relay agent needs to poll this
 * device's pending enrollments and push faces to it over the local
 * network. The key is shown exactly once — after closing this dialog it
 * can never be retrieved again, only revoked and replaced.
 */
export function AgentKeyDialog({
  device,
  onIssued,
}: {
  device: Device;
  onIssued: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const { agentKey: key } = await devicesApi.generateAgentKey(device.id);
      setAgentKey(key);
      onIssued();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Kalit yaratib bo'lmadi"));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAgentKey(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Radio className="size-4" />
          {device.hasAgent ? "Agent kaliti" : "Agent ulash"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relay agent kaliti — {device.name}</DialogTitle>
          <DialogDescription>
            Planshet yoki telefon (Face ID bilan bir Wi‑Fi)dagi relay dasturi shu
            kalit orqali serverga ulanadi. Oddiy operator ham kalit yarata oladi.
          </DialogDescription>
        </DialogHeader>

        {agentKey ? (
          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-muted p-3">
              <p className="mb-1 text-xs text-muted-foreground">API manzil</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs">{API_URL}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCopy(API_URL)}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted p-3">
              <p className="mb-1 text-xs text-muted-foreground">Qurilma ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs">{device.id}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCopy(device.id)}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted p-3">
              <p className="mb-1 text-xs text-muted-foreground">Agent kaliti</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs">{agentKey}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCopy(agentKey)}
                >
                  {copied ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-destructive">
              Bu kalit faqat bir marta ko&apos;rsatiladi — uni relay dasturining
              sozlash faylига (.env) hoziroq nusxalab qo&apos;ying.
            </p>
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            {device.hasAgent
              ? "Bu qurilmada allaqachon agent kaliti mavjud. Yangisini yaratsangiz, eskisi ishlamay qoladi."
              : "Hali agent kaliti yaratilmagan."}
          </p>
        )}

        <DialogFooter>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
            {isGenerating && <Loader2 className="animate-spin" />}
            {device.hasAgent ? "Yangi kalit yaratish" : "Kalit yaratish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
