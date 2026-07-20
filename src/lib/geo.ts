import { headers } from "next/headers";
import type { Currency } from "@/lib/plans";

// Detect the viewer's currency from the hosting platform's geo headers.
// Vercel: x-vercel-ip-country · Cloudflare: cf-ipcountry · AWS CloudFront:
// cloudfront-viewer-country. Falls back to USD (also the local-dev default).
export async function getCurrency(): Promise<Currency> {
  const h = await headers();
  const country = (
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("cloudfront-viewer-country") ||
    h.get("x-country") ||
    ""
  ).toUpperCase();
  return country === "IN" ? "INR" : "USD";
}
