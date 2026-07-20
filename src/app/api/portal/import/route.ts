import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET, buildUserObjectKey } from "@/lib/s3";
import { getMyEmail } from "@/lib/portal";
import { getMyAccount } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

// Copy an entire studio delivery (a "Shared with me" space) into the customer's
// own My Drive, under a new folder — so they permanently own a copy.
export async function POST(req: Request) {
  const email = await getMyEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Must have an active plan to store files in My Drive.
  const account = await getMyAccount();
  if (account?.subscriptionStatus !== "active") {
    return NextResponse.json(
      { error: "Choose a storage plan first to save files to My Drive." },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => null);
  const studioSpace = body?.studioSpace as string | undefined;
  const name = String(body?.name ?? "")
    .trim()
    .replace(/[\/\\]/g, "")
    .slice(0, 120);
  if (!studioSpace || !name) {
    return NextResponse.json({ error: "Missing folder name." }, { status: 400 });
  }

  // The studioSpace must be one of this person's own delivery accounts.
  const myAccounts = await getMyCustomerAccounts();
  if (!myAccounts.some((a) => String(a._id) === studioSpace)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const scope = { customerId: studioSpace, ownerType: "studio" as const };

  // Create the destination root folder in My Drive.
  let root;
  try {
    root = await Folder.create({
      ownerType: "customer",
      ownerEmail: email,
      parentId: null,
      name,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "You already have a folder with that name in My Drive." },
        { status: 409 }
      );
    }
    throw err;
  }

  // Recreate the studio's folder tree under the new root (parents first).
  const studioFolders = await Folder.find(scope)
    .select("name parentId")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; parentId: mongoose.Types.ObjectId | null }[]>();
  const map = new Map<string, string>(); // studio folderId -> new customer folderId
  let remaining = studioFolders.map((f) => ({
    id: String(f._id),
    name: f.name,
    parent: f.parentId ? String(f.parentId) : null,
  }));
  let guard = 0;
  while (remaining.length && guard++ < 5000) {
    const next: typeof remaining = [];
    for (const f of remaining) {
      const parentId = f.parent === null ? String(root._id) : map.get(f.parent);
      if (parentId === undefined) {
        next.push(f);
        continue;
      }
      const created = await Folder.create({
        ownerType: "customer",
        ownerEmail: email,
        parentId,
        name: f.name,
      });
      map.set(f.id, String(created._id));
    }
    if (next.length === remaining.length) break; // no progress — stop
    remaining = next;
  }

  // Copy each file's object in storage and create a customer-owned record.
  const files = await FileModel.find({ ...scope, status: "ready" }).lean<
    {
      _id: mongoose.Types.ObjectId;
      key: string;
      filename: string;
      contentType: string;
      size: number;
      folderId: mongoose.Types.ObjectId | null;
    }[]
  >();

  let copied = 0;
  for (const f of files) {
    const targetFolder = f.folderId
      ? map.get(String(f.folderId)) ?? String(root._id)
      : String(root._id);
    const newKey = buildUserObjectKey(
      email,
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
      continue; // skip a file that failed to copy
    }
    await FileModel.create({
      ownerType: "customer",
      ownerEmail: email,
      folderId: targetFolder,
      key: newKey,
      filename: f.filename,
      contentType: f.contentType,
      size: f.size,
      status: "ready",
    });
    copied++;
  }

  return NextResponse.json({ ok: true, copied });
}
