import { NextResponse } from "next/server";
import { getMyOwner } from "@/lib/account";
import {
  validRegularGb,
  quoteRegular,
  MIN_REGULAR_GB,
} from "@/lib/regularPricing";

// Price a custom GB amount of Regular storage.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const gb = validRegularGb(body?.gb);
  if (gb === null) {
    return NextResponse.json(
      { error: `Enter at least ${MIN_REGULAR_GB} GB.` },
      { status: 400 }
    );
  }
  return NextResponse.json(quoteRegular(gb));
}
