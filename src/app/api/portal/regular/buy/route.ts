import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyAccount } from "@/lib/account";
import {
  validRegularGb,
  quoteRegular,
  regularYearlyPrice,
  gbToBytes,
  MIN_REGULAR_GB,
} from "@/lib/regularPricing";
import type { Currency } from "@/lib/plans";

// Buy Regular-storage quota (custom GB, min 50, billed yearly). Tops up the
// account's existing quota. Payment is mocked for now (Phase 9 → Razorpay).
export async function POST(req: Request) {
  const account = await getMyAccount();
  if (!account) {
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
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";
  const price = regularYearlyPrice(quoteRegular(gb), currency);

  await connectToDatabase();
  // TODO(Phase 9): real Razorpay yearly subscription. Mocked as paid.
  account.regularBytes = (account.regularBytes ?? 0) + gbToBytes(gb);
  account.subscriptionStatus = "active";
  await account.save();

  return NextResponse.json({
    ok: true,
    addedGb: gb,
    regularBytes: account.regularBytes,
    price,
    currency,
  });
}
