import { NextResponse } from "next/server";
import { getMyOwner } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getSelectedDeepFiles } from "@/lib/deepSelection";
import { quoteArchive } from "@/lib/archivePricing";

// Price the whole "selected for deep storage" set for a chosen term.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const myAccounts = await getMyCustomerAccounts();
  const selected = await getSelectedDeepFiles(
    owner.accountId,
    myAccounts.map((a) => String(a._id))
  );

  const sizeBytes = selected.reduce((s, f) => s + (f.size || 0), 0);
  return NextResponse.json(quoteArchive(sizeBytes, selected.length, body?.years));
}
