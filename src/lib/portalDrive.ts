import mongoose from "mongoose";
import { customerScope } from "@/lib/portal";
import {
  resolveFolder,
  getBreadcrumb,
  loadAllFolders,
  buildFolderPaths,
  collectFolderAndDescendants,
} from "@/lib/folders";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

export type Tier = "temporary" | "regular";

function iso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString();
}

// Load one tier's contents for a folder (null/undefined folderParam = root):
// subfolders (with per-folder total size), files of that tier, breadcrumb, and
// move targets. Shared by the portal page and the dedicated folder page.
export async function loadTier(
  accountId: string,
  tier: Tier,
  folderParam?: string
) {
  const scope = customerScope(accountId);
  const resolved = await resolveFolder(scope, folderParam);
  const currentFolderId = resolved.ok ? resolved.folderId : null;
  const folderValid = resolved.ok;

  // Temporary (My Uploads) hides anything tagged for Cold Drive — those files
  // live in the Payment Pending list now. Other tiers still show them (badged).
  const fileVisibility =
    tier === "temporary"
      ? { deepStatus: "none" as const }
      : { deepStatus: { $ne: "archiving" as const } };

  const [folders, files, breadcrumb, allFolders] = await Promise.all([
    Folder.find({ ...scope, parentId: currentFolderId }).sort({ name: 1 }).lean(),
    FileModel.find({
      ...scope,
      folderId: currentFolderId,
      status: "ready",
      tier,
      ...fileVisibility,
    })
      .sort({ createdAt: -1 })
      .lean(),
    getBreadcrumb(scope, currentFolderId),
    loadAllFolders(scope),
  ]);

  // Per-folder stats (this tier), including nested descendant folders:
  //   bytes/visible = files still shown here; total = all live files (any tag).
  const visibleCond =
    tier === "temporary"
      ? { $eq: ["$deepStatus", "none"] }
      : { $ne: ["$deepStatus", "archiving"] };
  const statAgg = await FileModel.aggregate([
    {
      $match: {
        ownerType: "customer",
        ownerAccountId: new mongoose.Types.ObjectId(accountId),
        status: "ready",
        tier,
        deepStatus: { $ne: "archiving" },
      },
    },
    {
      $group: {
        _id: "$folderId",
        bytes: { $sum: { $cond: [visibleCond, "$size", 0] } },
        visible: { $sum: { $cond: [visibleCond, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  const statByFolder = new Map<
    string,
    { bytes: number; visible: number; total: number }
  >(
    statAgg.map((s) => [
      String(s._id),
      { bytes: s.bytes as number, visible: s.visible as number, total: s.total as number },
    ])
  );
  const rollup = (id: string, key: "bytes" | "visible" | "total") => {
    let sum = 0;
    for (const fid of collectFolderAndDescendants(allFolders, [id]))
      sum += statByFolder.get(fid)?.[key] ?? 0;
    return sum;
  };

  let folderRows = folders.map((f) => ({
    id: String(f._id),
    name: f.name,
    createdAt: iso(f.createdAt),
    sizeBytes: rollup(String(f._id), "bytes"),
  }));
  // Hide folders whose files are all in Cold Drive's Payment Pending list
  // (nothing visible remains) — but keep genuinely empty folders.
  if (tier === "temporary") {
    folderRows = folderRows.filter(
      (f) => !(rollup(f.id, "total") > 0 && rollup(f.id, "visible") === 0)
    );
  }

  return {
    currentFolderId,
    folderValid,
    breadcrumb,
    moveTargets: buildFolderPaths(allFolders),
    folderRows,
    fileRows: files.map((f) => ({
      id: String(f._id),
      filename: f.filename,
      size: f.size,
      createdAt: iso(f.createdAt),
      deepTag:
        f.deepStatus === "selected"
          ? ("selected" as const)
          : f.deepStatus === "moved"
            ? ("moved" as const)
            : null,
    })),
  };
}
