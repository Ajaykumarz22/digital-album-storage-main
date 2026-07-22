import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsS3, AWS_ARCHIVE_BUCKET } from "@/lib/aws";
import { authorizeArchive } from "@/lib/archiveAuth";

// Download a restored archive (the whole .zip). Only works while the archive is
// "available" (a restore has completed and not yet expired).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const archive = await authorizeArchive(id);
  if (!archive) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (archive.status !== "available") {
    return NextResponse.json(
      { error: "This archive isn't restored yet. Request a restore first." },
      { status: 409 }
    );
  }

  const safe = archive.name.replace(/[^a-zA-Z0-9._ -]/g, "_") || "archive";
  const url = await getSignedUrl(
    awsS3,
    new GetObjectCommand({
      Bucket: AWS_ARCHIVE_BUCKET,
      Key: archive.bucketKey,
      ResponseContentDisposition: `attachment; filename="${safe}.zip"`,
    }),
    { expiresIn: 600 }
  );

  return NextResponse.redirect(url);
}
