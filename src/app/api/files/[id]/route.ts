import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { getOwnedCustomer } from "@/lib/studio";
import { FileModel } from "@/models/File";
import { Customer } from "@/models/Customer";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const file = await FileModel.findById(id);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Authorization: the file's customer must belong to the logged-in studio,
  // AND the file must be studio-owned (studios never touch customer uploads).
  const customer = await getOwnedCustomer(String(file.customerId));
  if (!customer || file.ownerType !== "studio") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Remove the object from iDrive (ignore if already gone).
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.key }));
  } catch {
    // Object may already be deleted; continue to clean up the database record.
  }

  const freed = file.status === "ready" ? file.size : 0;
  await file.deleteOne();

  if (freed > 0) {
    await Customer.updateOne(
      { _id: customer._id },
      { $inc: { storageBytes: -freed } }
    );
  }

  return NextResponse.json({ ok: true });
}
