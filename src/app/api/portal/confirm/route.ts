import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { getMyOwner } from "@/lib/account";
import { FileModel } from "@/models/File";

export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileId = body?.fileId as string | undefined;
  if (!fileId || !mongoose.isValidObjectId(fileId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectToDatabase();
  // Only the owner can confirm their own upload.
  const file = await FileModel.findOne({
    _id: fileId,
    ownerType: "customer",
    ownerAccountId: owner.accountId,
  });
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (file.status === "ready") {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: file.key })
    );
    file.size = head.ContentLength ?? file.size;
  } catch {
    return NextResponse.json(
      { error: "Upload not found in storage." },
      { status: 400 }
    );
  }

  file.status = "ready";
  await file.save();

  return NextResponse.json({ ok: true });
}
