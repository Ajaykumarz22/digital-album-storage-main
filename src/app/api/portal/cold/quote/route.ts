import { NextResponse } from "next/server";
import { validColdGb, quoteCold, MIN_COLD_GB } from "@/lib/coldPricing";

// Price a custom GB amount of Cold Drive capacity (billed yearly).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gb = validColdGb(body?.gb);
  if (gb === null) {
    return NextResponse.json(
      { error: `Enter at least ${MIN_COLD_GB} GB.` },
      { status: 400 }
    );
  }
  return NextResponse.json(quoteCold(gb));
}
