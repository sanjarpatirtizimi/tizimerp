"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import type { Driver } from "@/lib/types";

export function TelegramField({
  driver,
  onChanged,
}: {
  driver: Driver;
  onChanged: (driver: Driver) => void;
}) {
  const [value, setValue] = useState(driver.telegramUsername ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await driversApi.setTelegram(
        driver.id,
        value.trim() || null,
      );
      onChanged(updated);
      setValue(updated.telegramUsername ?? "");
      toast.success("Telegram saqlandi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Telegram</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="@username yoki telefon"
        />
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : "Saqlash"}
        </Button>
      </CardContent>
    </Card>
  );
}
