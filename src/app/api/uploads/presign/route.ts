import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET, buildObjectKey } from "@/lib/s3";
import { getOwnedCustomer } from "@/lib/studio";
import { resolveFolder } from "@/lib/folders";
import { FileModel } from "@/models/File";

// Largest single-request upload we allow (5 GB — the S3 single-PUT limit).
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { customerId, filename, contentType, size, folderId } = body as {
    customerId?: string;
    filename?: string;
    contentType?: string;
    size?: number;
    folderId?: string | null;
  };

  if (!customerId || !filename) {
    return NextResponse.json(
      { error: "Missing customerId or filename." },
      { status: 400 }
    );
  }
  if (typeof size === "number" && size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File is larger than the 5 GB limit." },
      { status: 400 }
    );
  }

  // Authorization: the customer must belong to the logged-in studio.
  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Validate the target folder belongs to this customer (null = root), and is a
  // studio-owned folder (studios only deliver into their own folders).
  const folder = await resolveFolder(
    { customerId: customer._id, ownerType: "studio" },
    folderId
  );
  if (!folder.ok) {
    return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  }

  // This upload is a studio delivery — owned by the studio (the logged-in user).
  const actingUser = await currentUser();
  const ownerEmail =
    actingUser?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";

  const type = contentType || "application/octet-stream";
  const key = buildObjectKey(
    String(customer.studioId),
    String(customer._id),
    filename,
    `${Date.now()}-${randomUUID().slice(0, 8)}`
  );

  // Pre-record the file as "pending"; confirmed after the browser finishes.
  await connectToDatabase();
  const fileDoc = await FileModel.create({
    studioId: customer.studioId,
    customerId: customer._id,
    ownerType: "studio",
    ownerEmail,
    folderId: folder.folderId,
    key,
    filename,
    contentType: type,
    size: typeof size === "number" ? size : 0,
    status: "pending",
  });

  // A short-lived signed URL the browser PUTs the file bytes to directly.
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: type }),
    { expiresIn: 300 }
  );

  return NextResponse.json({ url, key, fileId: String(fileDoc._id) });
}
