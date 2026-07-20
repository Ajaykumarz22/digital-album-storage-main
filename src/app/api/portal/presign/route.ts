import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET, buildUserObjectKey } from "@/lib/s3";
import { getMyEmail, customerScope } from "@/lib/portal";
import { resolveFolder } from "@/lib/folders";
import { FileModel } from "@/models/File";

const MAX_SIZE = 5 * 1024 * 1024 * 1024;

export async function POST(req: Request) {
  const email = await getMyEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { filename, contentType, size, folderId } = (body ?? {}) as {
    filename?: string;
    contentType?: string;
    size?: number;
    folderId?: string | null;
  };

  if (!filename) {
    return NextResponse.json({ error: "Missing filename." }, { status: 400 });
  }
  if (typeof size === "number" && size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File is larger than the 5 GB limit." },
      { status: 400 }
    );
  }

  const folder = await resolveFolder(customerScope(email), folderId);
  if (!folder.ok) {
    return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  }

  const type = contentType || "application/octet-stream";
  const key = buildUserObjectKey(
    email,
    filename,
    `${Date.now()}-${randomUUID().slice(0, 8)}`
  );

  await connectToDatabase();
  const fileDoc = await FileModel.create({
    ownerType: "customer",
    ownerEmail: email,
    folderId: folder.folderId,
    key,
    filename,
    contentType: type,
    size: typeof size === "number" ? size : 0,
    status: "pending",
  });

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: type }),
    { expiresIn: 300 }
  );

  return NextResponse.json({ url, key, fileId: String(fileDoc._id) });
}
