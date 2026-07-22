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

  const [folders, files, breadcrumb, allFolders] = await Promise.all([
    Folder.find({ ...scope, parentId: currentFolderId }).sort({ name: 1 }).lean(),
    FileModel.find({
      ...scope,
      folderId: currentFolderId,
      status: "ready",
      tier,
      deepStatus: { $ne: "archiving" },
    })
      .sort({ createdAt: -1 })
      .lean(),
    getBreadcrumb(scope, currentFolderId),
    loadAllFolders(scope),
  ]);

  // Per-folder total size (this tier), including nested descendant folders.
  const sizeAgg = await FileModel.aggregate([
    {
      $match: {
        ownerType: "customer",
        ownerAccountId: new mongoose.Types.ObjectId(accountId),
        status: "ready",
        tier,
        deepStatus: { $ne: "archiving" },
      },
    },
    { $group: { _id: "$folderId", bytes: { $sum: "$size" } } },
  ]);
  const bytesByFolder = new Map<string, number>(
    sizeAgg.map((s) => [String(s._id), s.bytes as number])
  );
  const folderSize = (id: string) => {
    let total = 0;
    for (const fid of collectFolderAndDescendants(allFolders, [id]))
      total += bytesByFolder.get(fid) ?? 0;
    return total;
  };

  return {
    currentFolderId,
    folderValid,
    breadcrumb,
    moveTargets: buildFolderPaths(allFolders),
    folderRows: folders.map((f) => ({
      id: String(f._id),
      name: f.name,
      createdAt: iso(f.createdAt),
      sizeBytes: folderSize(String(f._id)),
    })),
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
