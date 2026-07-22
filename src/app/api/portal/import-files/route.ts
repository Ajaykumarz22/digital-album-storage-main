import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET, buildUserObjectKey } from "@/lib/s3";
import { getMyOwner, getMyAccount, regularUsedBytes } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { humanBytes } from "@/lib/archivePricing";
import { FileModel } from "@/models/File";

// "Move to Hot drive" from a studio-shared space — copies the selected
// shared files into the customer's Regular tier. Needs enough purchased quota.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const account = await getMyAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const studioSpace = body?.studioSpace as string | undefined;
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  if (!studioSpace || !mongoose.isValidObjectId(studioSpace) || fileIds.length === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  const myAccounts = await getMyCustomerAccounts();
  if (!myAccounts.some((a) => String(a._id) === studioSpace)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const files = await FileModel.find({
    _id: { $in: fileIds },
    customerId: studioSpace,
    ownerType: "studio",
    status: "ready",
  })
    .select("key filename contentType size")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        key: string;
        filename: string;
        contentType: string;
        size: number;
      }[]
    >();

  // Quota check — these copies land in the paid Regular tier.
  const incoming = files.reduce((s, f) => s + (f.size || 0), 0);
  const used = await regularUsedBytes(owner.accountId);
  if (used + incoming > (account.regularBytes ?? 0)) {
    return NextResponse.json(
      {
        error: `Not enough Hot drive — need ${humanBytes(
          used + incoming - (account.regularBytes ?? 0)
        )} more. Buy more storage first.`,
        needMore: true,
      },
      { status: 402 }
    );
  }

  let copied = 0;
  for (const f of files) {
    const newKey = buildUserObjectKey(
      owner.accountId,
      f.filename,
      `${Date.now()}-${randomUUID().slice(0, 8)}`
    );
    try {
      await s3.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: `${S3_BUCKET}/${f.key}`,
          Key: newKey,
        })
      );
    } catch {
      continue;
    }
    await FileModel.create({
      ownerType: "customer",
      ownerAccountId: owner.accountId,
      ownerEmail: owner.email,
      folderId: null,
      key: newKey,
      filename: f.filename,
      contentType: f.contentType,
      size: f.size,
      status: "ready",
      deepStatus: "none",
      tier: "regular",
      sourceFileId: f._id,
    });
    copied++;
  }

  return NextResponse.json({ ok: true, copied });
}
