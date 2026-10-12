import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, Download } from "lucide-react";
import { STRINGS } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/i18n";
import { TOPICS } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/topics";
import { requireRole } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "QR კოდები — ადამიანის ატლასი 3D" };

export default async function QrPage() {
  // Printing QR codes for textbooks is a teacher's tool.
  await requireRole(["super_admin", "school_admin", "teacher"], "/qr");
  const t = STRINGS.ka;
  const base = await siteUrl();
  const codes = await Promise.all(
    TOPICS.map(async (topic) => {
      const url = `${base}/topic/${topic.slug}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: "#10231f", light: "#ffffff" },
      });
      return { topic, url, svg };
    }),
  );
  const isLocal = /localhost|127\.0\.0\.1/.test(base);

  return (
    <main className="min-h-dvh bg-page px-6 py-8 font-sans text-ink print:bg-card print:p-0">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <Link href="/anatomy" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <ArrowLeft className="size-4" />
              {t.title}
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl">{t.qrPageTitle}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-copy">{t.qrPageLead}</p>
          </div>
          <PrintButton label={t.printQr} />
        </header>

        {isLocal && (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning print:hidden">
            ⚠️ ეს კოდები ახლა <b>{base}</b>-ს მიუთითებს და მხოლოდ ამ კომპიუტერზე იმუშავებს. საჯარო მისამართზე
            განთავსების შემდეგ დააყენე NEXT_PUBLIC_SITE_URL და კოდები თავიდან დაბეჭდე.
          </p>
        )}

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-3">
          {codes.map(({ topic, url, svg }) => (
            <li
              key={topic.slug}
              className="flex break-inside-avoid flex-col items-center rounded-lg border border-line bg-card p-5 text-center"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: topic.color }} />
                {topic.title}
              </h2>
              <p className="text-sm text-mute">{topic.subtitle}</p>
              <div className="mt-3 w-44 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="mt-2 text-xs text-copy">{t.qrScan}</p>
              <p className="mt-1 text-[11px] break-all text-faint">{url}</p>
              <div className="mt-3 flex gap-2 print:hidden">
                <Link
                  href={`/topic/${topic.slug}`}
                  className="inline-flex h-10 items-center rounded-lg border border-line-strong px-3 text-[13px] font-medium hover:bg-subtle"
                >
                  {t.openTopic}
                </Link>
                <a
                  href={`/qr/${topic.slug}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium hover:bg-subtle"
                >
                  <Download className="size-4" />
                  SVG
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
