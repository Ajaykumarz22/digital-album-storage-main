import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope, getMyEmail } from "@/lib/portal";
import { getMyAccount, regularUsedBytes } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { humanBytes } from "@/lib/archivePricing";
import { Studio } from "@/models/Studio";
import { FileModel } from "@/models/File";
import {
  importableSharedFiles,
  importDelivery,
  type DeliveryFile,
} from "@/lib/importDelivery";

type TempFile = { _id: mongoose.Types.ObjectId; size: number };

// Move EVERYTHING in My Uploads (that isn't tagged for Cold Drive) into paid
// Hot drive in one click: the customer's own Temporary files (tier flip) AND
// the studio deliveries shared with them (copied in). Combined quota check.
export async function POST() {
  const account = await getMyAccount();
  const email = await getMyEmail();
  if (!account || !email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const accountId = String(account._id);

  await connectToDatabase();

  // 1) The customer's own Temporary uploads not tagged for Cold Drive.
  const ownFiles = await FileModel.find({
    ...customerScope(accountId),
    status: "ready",
    tier: "temporary",
    deepStatus: "none",
  })
    .select("size")
    .lean<TempFile[]>();
  const ownBytes = ownFiles.reduce((s, f) => s + (f.size || 0), 0);

  // 2) Studio deliveries with importable (untagged) files.
  const myAccounts = await getMyCustomerAccounts();
  const deliveries: {
    studioSpace: string;
    studioId: string;
    files: DeliveryFile[];
    bytes: number;
  }[] = [];
  for (const a of myAccounts) {
    const files = await importableSharedFiles(String(a._id));
    if (files.length) {
      deliveries.push({
        studioSpace: String(a._id),
        studioId: String(a.studioId),
        files,
        bytes: files.reduce((s, f) => s + (f.size || 0), 0),
      });
    }
  }
  const sharedBytes = deliveries.reduce((s, d) => s + d.bytes, 0);

  const incoming = ownBytes + sharedBytes;
  if (incoming === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  // Combined quota check for everything about to land in Hot drive.
  const used = await regularUsedBytes(accountId);
  const capacity = account.regularBytes ?? 0;
  if (used + incoming > capacity) {
    const shortBy = used + incoming - capacity;
    return NextResponse.json(
      {
        error: `Not enough Hot drive — you need ${humanBytes(
          shortBy
        )} more. Buy more storage first.`,
        needMore: true,
      },
      { status: 402 }
    );
  }

  let moved = 0;

  // Own files: just flip the tier.
  if (ownFiles.length) {
    await FileModel.updateMany(
      { _id: { $in: ownFiles.map((f) => f._id) } },
      { $set: { tier: "regular" } }
    );
    moved += ownFiles.length;
  }

  // Shared deliveries: copy them in, each under a folder named after the studio.
  if (deliveries.length) {
    const studios = await Studio.find({
      _id: { $in: deliveries.map((d) => new mongoose.Types.ObjectId(d.studioId)) },
    })
      .select("name email")
      .lean<{ _id: unknown; name: string; email: string }[]>();
    const nameById = new Map(
      studios.map((s) => [String(s._id), s.name || s.email || "Studio"])
    );
    for (const d of deliveries) {
      moved += await importDelivery({
        accountId,
        email,
        studioSpace: d.studioSpace,
        name: nameById.get(d.studioId) ?? "Shared",
        files: d.files,
      });
    }
  }

  return NextResponse.json({ ok: true, moved });
}
