import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Georgian } from "next/font/google";
import { OfflineSupport } from "@/components/OfflineSupport";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-app",
  subsets: ["latin"],
});

const georgian = Noto_Sans_Georgian({
  variable: "--font-georgian",
  subsets: ["georgian"],
});

export const metadata: Metadata = {
  title: "ადამიანის ატლასი 3D — ინტერაქტიული ანატომია",
  description:
    "ინტერაქტიული 3D ანატომიის ატლასი საქართველოს სკოლებისთვის: 2 234 სტრუქტურა, გულის მუშაობის, სუნთქვისა და სისხლის მიმოქცევის ანიმაციები.",
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
    <html lang="ka" className={`${notoSans.variable} ${georgian.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <OfflineSupport />
      </body>
    </html>
  );
}
