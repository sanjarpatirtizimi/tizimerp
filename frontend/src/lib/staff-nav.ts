import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Server,
  Package,
  UserCog,
  BarChart3,
  Clock3,
  Flag,
  Megaphone,
  MessageSquareText,
  Wallet,
} from "lucide-react";

export type StaffNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const staffBottomNav: StaffNavItem[] = [
  { href: "/staff/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/staff/operator-cash", label: "Operator puli", icon: Wallet },
  { href: "/staff/visits", label: "Kelishlar", icon: Clock3 },
  { href: "/staff/drivers/new", label: "Ro'yxat", icon: Users },
];

export const staffSideNavAll: StaffNavItem[] = [
  { href: "/staff/devices", label: "Qurilmalar", icon: Server },
  { href: "/staff/flagged", label: "Qizil belgilar", icon: Flag },
  { href: "/staff/feedback", label: "Murojaatlar", icon: MessageSquareText },
];

export const staffSideNavSuperAdmin: StaffNavItem[] = [
  { href: "/staff/analytics", label: "Statistika", icon: BarChart3 },
  { href: "/staff/ads", label: "Reklamalar", icon: Megaphone },
  { href: "/staff/products", label: "Mahsulotlar", icon: Package },
  { href: "/staff/users", label: "Operatorlar", icon: UserCog },
];

/** Square hub tiles on Super Admin home (statistika). */
export const superAdminHubTiles: StaffNavItem[] = [
  { href: "/staff/visits", label: "Kelishlar", icon: Clock3 },
  { href: "/staff/drivers/new", label: "Ro'yxat", icon: Users },
  { href: "/staff/flagged", label: "Qizil belgi", icon: Flag },
  { href: "/staff/dashboard", label: "Haydovchilar", icon: LayoutDashboard },
  { href: "/staff/operator-cash", label: "Operator puli", icon: Wallet },
  { href: "/staff/devices", label: "Qurilmalar", icon: Server },
  { href: "/staff/products", label: "Mahsulotlar", icon: Package },
  { href: "/staff/ads", label: "Reklamalar", icon: Megaphone },
  { href: "/staff/feedback", label: "Murojaatlar", icon: MessageSquareText },
  { href: "/staff/users", label: "Operatorlar", icon: UserCog },
];

export function isSuperAdminHomeHub(pathname: string | null): boolean {
  return pathname === "/staff/analytics";
}
