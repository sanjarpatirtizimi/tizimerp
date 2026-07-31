import { RequireDriver } from "@/components/auth/route-guard";
import { DriverShell } from "@/components/layout/driver-shell";

export default function DriverAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireDriver>
      <DriverShell>{children}</DriverShell>
    </RequireDriver>
  );
}
