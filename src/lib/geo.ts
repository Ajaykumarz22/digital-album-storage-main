import { headers } from "next/headers";
import type { Currency } from "@/lib/plans";

// Detect the viewer's currency. Order:
//  1. A CDN/platform geo header if present (Vercel/Cloudflare/CloudFront).
//  2. Self-hosted (EC2 + Caddy): resolve the country from the client IP using
//     an offline GeoIP database (no external API calls).
// Falls back to USD (also the local-dev default, since localhost has no country).
export async function getCurrency(): Promise<Currency> {
  const h = await headers();

  const headerCountry = (
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("cloudfront-viewer-country") ||
    h.get("x-country") ||
    ""
  ).toUpperCase();
  if (headerCountry) return headerCountry === "IN" ? "INR" : "USD";

  const country = await countryFromIp(clientIp(h));
  return country === "IN" ? "INR" : "USD";
}

// The originating client IP as forwarded by the reverse proxy. Caddy sets
// X-Forwarded-For (first entry = the real client); X-Real-IP is a fallback.
function clientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

// Offline IP → ISO country code. Returns "" on any failure (→ USD default).
async function countryFromIp(ip: string | null): Promise<string> {
  if (!ip) return "";
  try {
    const mod = (await import("geoip-lite")) as unknown as {
      default?: { lookup(ip: string): { country?: string } | null };
      lookup?(ip: string): { country?: string } | null;
    };
    const lookup = mod.lookup ?? mod.default?.lookup;
    return lookup?.(ip)?.country ?? "";
  } catch {
    return "";
  }
}
