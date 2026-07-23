import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyAccount } from "@/lib/account";
import {
  validColdGb,
  quoteCold,
  coldYearlyPrice,
  gbToBytes,
  MIN_COLD_GB,
} from "@/lib/coldPricing";
import type { Currency } from "@/lib/plans";

// Buy Cold Drive capacity (custom GB, min 50, billed yearly). Tops up the
// account's existing quota. Payment is mocked for now (Phase 9 → Razorpay).
export async function POST(req: Request) {
  const account = await getMyAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const gb = validColdGb(body?.gb);
  if (gb === null) {
    return NextResponse.json(
      { error: `Enter at least ${MIN_COLD_GB} GB.` },
      { status: 400 }
    );
  }
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";
  const price = coldYearlyPrice(quoteCold(gb), currency);

  await connectToDatabase();
  // TODO(Phase 9): real Razorpay yearly subscription. Mocked as paid.
  account.coldBytes = (account.coldBytes ?? 0) + gbToBytes(gb);
  account.subscriptionStatus = "active";
  await account.save();

  return NextResponse.json({ ok: true, addedGb: gb, price, currency });
}
