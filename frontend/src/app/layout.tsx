import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { InstallPromptHost } from "@/components/pwa/install-prompt-host";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sanjar Patir | Haydovchilar Sodiqlik va Hamyon Tizimi",
  description:
    "Sanjar Patir haydovchilari uchun sodiqlik, hamyon va mini-ERP tizimi",
  applicationName: "Sanjar Patir",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sanjar Patir",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/brand/sanjar-patir-mark.png", type: "image/png" }],
    apple: [{ url: "/brand/sanjar-patir-mark.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#c45c26",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          {children}
          <InstallPromptHost />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
