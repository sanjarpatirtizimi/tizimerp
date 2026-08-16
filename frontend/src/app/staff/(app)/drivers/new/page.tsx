import Link from "next/link";
import { DriverForm } from "@/components/drivers/driver-form";

export default function NewDriverPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-lg font-semibold">Haydovchini yozish</h1>
        <Link
          href="/staff/qr"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          QR kod
        </Link>
      </div>
      <DriverForm />
    </div>
  );
}
