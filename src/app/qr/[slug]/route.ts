import QRCode from "qrcode";
import { TOPIC_BY_SLUG } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/topics";
import { siteUrl } from "@/lib/site-url";

// High-resolution SVG of one topic's QR code, for placing in textbook layouts.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!TOPIC_BY_SLUG[slug]) return new Response("Not found", { status: 404 });
  const url = `${await siteUrl()}/topic/${slug}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#10231f", light: "#ffffff" } });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="qr-${slug}.svg"`,
    },
  });
}
