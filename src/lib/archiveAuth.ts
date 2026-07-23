import mongoose, { type HydratedDocument } from "mongoose";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ArchiveModel, ArchiveType } from "@/models/Archive";
import { Account } from "@/models/Account";
import { Studio } from "@/models/Studio";

// Return the archive ONLY if the logged-in user owns it - a customer via their
// stable Account id, or a studio via its studio id. Otherwise null. Used by the
// restore + download routes so both owner types share one authorization path.
export async function authorizeArchive(
  archiveId: string
): Promise<HydratedDocument<ArchiveType> | null> {
  if (!mongoose.isValidObjectId(archiveId)) return null;
  const user = await currentUser();
  if (!user) return null;

  await connectToDatabase();
  const archive = await ArchiveModel.findOne({
    _id: archiveId,
    status: { $ne: "deleted" },
  });
  if (!archive) return null;

  if (archive.ownerType === "customer") {
    const acct = await Account.findOne({ clerkUserId: user.id })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();
    if (
      acct &&
      archive.ownerAccountId &&
      String(acct._id) === String(archive.ownerAccountId)
    ) {
      return archive;
    }
    return null;
  }

  // studio-owned archive
  const studio = await Studio.findOne({ clerkUserId: user.id })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }>();
  if (
    studio &&
    archive.studioId &&
    String(studio._id) === String(archive.studioId)
  ) {
    return archive;
  }
  return null;
}
