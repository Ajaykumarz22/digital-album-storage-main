import { NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { getOwnedCustomer } from "@/lib/studio";
import { FileModel } from "@/models/File";
import { Customer } from "@/models/Customer";
import mongoose from "mongoose";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const fileId = body?.fileId as string | undefined;
  if (!fileId || !mongoose.isValidObjectId(fileId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectToDatabase();
  const file = await FileModel.findById(fileId);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Authorization: confirm the file's customer belongs to this studio.
  const customer = await getOwnedCustomer(String(file.customerId));
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (file.status === "ready") {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  // Verify the object really exists in storage, and trust its true size
  // (rather than what the browser claimed).
  let realSize = file.size;
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: file.key })
    );
    realSize = head.ContentLength ?? file.size;
  } catch {
    return NextResponse.json(
      { error: "Upload not found in storage." },
      { status: 400 }
    );
  }

  file.size = realSize;
  file.status = "ready";
  await file.save();

  // Add this file's size to the customer's running storage total.
  await Customer.updateOne(
    { _id: customer._id },
    { $inc: { storageBytes: realSize } }
  );

  return NextResponse.json({ ok: true });
}
