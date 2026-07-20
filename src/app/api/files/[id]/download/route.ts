import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { FileModel } from "@/models/File";
import { Customer } from "@/models/Customer";
import { Studio } from "@/models/Studio";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();
  const file = await FileModel.findById(id);
  if (!file || file.status !== "ready") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();

  if (file.ownerType === "customer") {
    // A customer's own private file — only the owner may download it.
    if (!email || file.ownerEmail.toLowerCase() !== email) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
  } else {
    // A studio delivery — the receiving customer, or the owning studio.
    const customer = await Customer.findById(file.customerId);
    if (!customer) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const isOwningCustomer =
      customer.clerkUserId === user.id ||
      (!!email && customer.email.toLowerCase() === email);

    let isOwningStudio = false;
    if (!isOwningCustomer) {
      const studio = await Studio.findOne({ clerkUserId: user.id });
      isOwningStudio = !!studio && String(studio._id) === String(file.studioId);
    }

    if (!isOwningCustomer && !isOwningStudio) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    // Customers may only download shared files while access is active.
    if (isOwningCustomer && customer.status === "locked") {
      return NextResponse.json(
        { error: "Your access is locked. Please subscribe to download." },
        { status: 402 }
      );
    }
  }

  // Short-lived signed link that forces a download with the original name.
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: file.key,
      ResponseContentDisposition: `attachment; filename="${file.filename.replace(/"/g, "")}"`,
    }),
    { expiresIn: 300 }
  );

  return NextResponse.redirect(url);
}
