import { RequireStaff } from "@/components/auth/route-guard";
import { StaffShell } from "@/components/layout/staff-shell";

export default function StaffAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireStaff>
      <StaffShell>{children}</StaffShell>
    </RequireStaff>
  );
}
