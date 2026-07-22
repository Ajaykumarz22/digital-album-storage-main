import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getOwnedCustomer } from "@/lib/studio";
import { resolveArchiveSource } from "@/lib/archiveSource";
import {
  quoteArchive,
  MIN_ARCHIVE_BYTES,
  humanBytes,
} from "@/lib/archivePricing";

// Price a studio's selection of a customer's delivered files for archiving.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId." }, { status: 400 });
  }
  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  const scope = { customerId: customer._id, ownerType: "studio" as const };
  const { sizeBytes, fileCount } = await resolveArchiveSource(
    scope,
    fileIds,
    folderIds
  );

  if (fileCount === 0) {
    return NextResponse.json(
      { error: "Nothing to archive in the selection." },
      { status: 400 }
    );
  }
  if (sizeBytes < MIN_ARCHIVE_BYTES) {
    return NextResponse.json(
      {
        error: `Deep Storage needs at least ${humanBytes(
          MIN_ARCHIVE_BYTES
        )} per archive. Your selection is ${humanBytes(sizeBytes)}.`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(quoteArchive(sizeBytes, fileCount, body?.years));
}
