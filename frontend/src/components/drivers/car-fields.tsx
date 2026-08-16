"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CAR_PLATE_HELP,
  CAR_PLATE_HINT,
  isValidCarPlate,
} from "@/lib/car-plate";
import { cn } from "@/lib/utils";

export function CarPlateField({
  id,
  value,
  onChange,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const typed = value.trim().length > 0;
  const invalid = typed && !isValidCarPlate(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Mashina raqami</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={CAR_PLATE_HINT}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        aria-invalid={invalid}
      />
      <p
        className={cn(
          "text-xs",
          invalid ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {CAR_PLATE_HELP}
      </p>
    </div>
  );
}

export function CarNameField({
  id,
  value,
  onChange,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Mashina nomi</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Isuzu, Damas, Cobalt..."
        required={required}
      />
    </div>
  );
}
