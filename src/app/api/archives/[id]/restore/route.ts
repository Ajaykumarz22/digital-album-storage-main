import { NextResponse } from "next/server";
import { RestoreObjectCommand } from "@aws-sdk/client-s3";
import { awsS3, AWS_ARCHIVE_BUCKET } from "@/lib/aws";
import { authorizeArchive } from "@/lib/archiveAuth";
import { restoreQueue } from "@/lib/queue";
import {
  restoreQuote,
  restorePriceIn,
  RESTORE_AVAILABLE_DAYS,
} from "@/lib/archivePricing";
import type { Currency } from "@/lib/plans";

// Kick off a Deep Archive restore ("thaw"). Takes the (mock) restore fee, fires
// the async AWS RestoreObject, flips the archive to "restoring", and queues the
// poller that will flip it to "available" once AWS finishes (12-48h).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const archive = await authorizeArchive(id);
  if (!archive) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (archive.status !== "archived") {
    return NextResponse.json(
      { error: `This archive is "${archive.status}", not ready to restore.` },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";
  const quote = restoreQuote(archive.sizeBytes);
  const price = restorePriceIn(quote, currency);

  // TODO(Phase 9): real Razorpay charge. Mocked for now.
  try {
    await awsS3.send(
      new RestoreObjectCommand({
        Bucket: AWS_ARCHIVE_BUCKET,
        Key: archive.bucketKey,
        RestoreRequest: {
          Days: RESTORE_AVAILABLE_DAYS,
          GlacierJobParameters: { Tier: "Bulk" },
        },
      })
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Could not start restore: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  archive.status = "restoring";
  archive.set("restore.requestedAt", new Date());
  archive.set("restore.tier", "Bulk");
  archive.set("restore.feePaid", price);
  archive.set("restore.currency", currency);
  await archive.save();

  // First check after a minute; the poller re-queues itself every 15 min.
  await restoreQueue.add(
    "check",
    { archiveId: String(archive._id) },
    { delay: 60_000, removeOnComplete: true, removeOnFail: true }
  );

  return NextResponse.json({ ok: true, price, currency });
}
