import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET, buildUserObjectKey } from "@/lib/s3";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

export type DeliveryFile = {
  _id: mongoose.Types.ObjectId;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  folderId: mongoose.Types.ObjectId | null;
};

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

// Files of a studio delivery still importable into the customer's Hot tier:
// ready and not tagged for Cold Drive (deepStatus "none").
export async function importableSharedFiles(
  studioSpace: string
): Promise<DeliveryFile[]> {
  return FileModel.find({
    customerId: studioSpace,
    ownerType: "studio",
    status: "ready",
    deepStatus: "none",
  })
    .select("key filename contentType size folderId")
    .lean<DeliveryFile[]>();
}

// Copy the given delivery files into the customer's Hot (regular) tier, under a
// fresh root folder (name deduped on conflict), recreating the delivery's folder
// tree. The caller owns the quota check. Returns how many files were copied.
export async function importDelivery(opts: {
  accountId: string;
  email: string;
  studioSpace: string;
  name: string;
  files: DeliveryFile[];
}): Promise<number> {
  const { accountId, email, studioSpace, name, files } = opts;
  if (files.length === 0) return 0;

  const clean = name.trim().replace(/[/\\]/g, "").slice(0, 120) || "Shared";

  // Create the destination root folder (append a suffix if the name is taken).
  let root: { _id: mongoose.Types.ObjectId } | null = null;
  for (let attempt = 0; attempt < 50 && !root; attempt++) {
    try {
      root = await Folder.create({
        ownerType: "customer",
        ownerAccountId: accountId,
        ownerEmail: email,
        parentId: null,
        name: attempt === 0 ? clean : `${clean} (${attempt})`,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) continue;
      throw err;
    }
  }
  if (!root) throw new Error("Could not create destination folder.");
  const rootId = String(root._id);

  // Recreate the studio's folder tree under the new root (parents first).
  const studioFolders = await Folder.find({
    customerId: studioSpace,
    ownerType: "studio",
  })
    .select("name parentId")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        name: string;
        parentId: mongoose.Types.ObjectId | null;
      }[]
    >();
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
      const parentId = f.parent === null ? rootId : map.get(f.parent);
      if (parentId === undefined) {
        next.push(f);
        continue;
      }
      const created = await Folder.create({
        ownerType: "customer",
        ownerAccountId: accountId,
        ownerEmail: email,
        parentId,
        name: f.name,
      });
      map.set(f.id, String(created._id));
    }
    if (next.length === remaining.length) break; // no progress - stop
    remaining = next;
  }

  // Copy each file's object in storage and create a customer-owned record.
  let copied = 0;
  for (const f of files) {
    const targetFolder = f.folderId
      ? map.get(String(f.folderId)) ?? rootId
      : rootId;
    const newKey = buildUserObjectKey(
      accountId,
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
      ownerAccountId: accountId,
      ownerEmail: email,
      folderId: targetFolder,
      key: newKey,
      filename: f.filename,
      contentType: f.contentType,
      size: f.size,
      status: "ready",
      tier: "regular",
      sourceFileId: f._id,
    });
    copied++;
  }

  return copied;
}
