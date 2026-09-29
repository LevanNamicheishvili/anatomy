import { headers } from "next/headers";

/**
 * Absolute base URL encoded into the QR codes. Set NEXT_PUBLIC_SITE_URL to the public domain
 * before printing; otherwise the current request's host is used (fine for testing on a LAN).
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
