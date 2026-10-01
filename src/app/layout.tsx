import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Georgian } from "next/font/google";
import localFont from "next/font/local";
import { ViewTransition } from "react";
import { OfflineSupport } from "@/components/OfflineSupport";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-app",
  subsets: ["latin"],
});

// Headings and the portal's name: BPG Glaho (one weight, lots of character).
const glaho = localFont({
  src: "./fonts/BPG-Glaho.woff2",
  variable: "--font-glaho",
  weight: "400",
  display: "swap",
});

// Everything else — body text, labels, buttons, forms, numbers: FiraGO, readable at small sizes and
// with real weights. Subset to Latin + Georgian (see src/app/fonts/FiraGO-OFL.txt).
const firago = localFont({
  src: [
    { path: "./fonts/FiraGO-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/FiraGO-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/FiraGO-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-firago",
  display: "swap",
});

const georgian = Noto_Sans_Georgian({
  variable: "--font-georgian",
  subsets: ["georgian"],
});

export const metadata: Metadata = {
  title: "სასწავლო პორტალი",
  description: "ინტერაქტიული სასწავლო მასალა საქართველოს სკოლებისთვის.",
  icons: { icon: "/sites/human-atlas-co-f41dd540/shared/seo/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka" className={`${glaho.variable} ${firago.variable} ${notoSans.variable} ${georgian.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Every navigation between pages animates (see the motion rules in globals.css). */}
        <ViewTransition default="page">{children}</ViewTransition>
        <OfflineSupport />
      </body>
    </html>
  );
}
