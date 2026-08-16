import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yozilish | Sanjar Patir",
  description: "QR kod orqali o'zingizni yozing",
};

export default function RoyxatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
