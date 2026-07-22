import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyOwner } from "@/lib/account";
import { resolveArchiveSource } from "@/lib/archiveSource";
import {
  quoteArchive,
  MIN_ARCHIVE_BYTES,
  humanBytes,
} from "@/lib/archivePricing";

// Price a selection for the "Move to Cold Drive" dialog. No writes.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  await connectToDatabase();
  const { sizeBytes, fileCount } = await resolveArchiveSource(
    customerScope(owner.accountId),
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
        error: `Cold Drive needs at least ${humanBytes(
          MIN_ARCHIVE_BYTES
        )} per archive. Your selection is ${humanBytes(sizeBytes)}.`,
      },
      { status: 400 }
    );
  }

  const quote = quoteArchive(sizeBytes, fileCount, body?.years);
  return NextResponse.json(quote);
}
