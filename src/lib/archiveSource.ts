import mongoose from "mongoose";
import {
  loadAllFolders,
  collectFolderAndDescendants,
  buildFolderPaths,
  type Scope,
} from "@/lib/folders";
import { FileModel } from "@/models/File";

export type SourceFile = {
  _id: mongoose.Types.ObjectId;
  key: string;
  filename: string;
  size: number;
  contentType: string;
  folderId: mongoose.Types.ObjectId | null;
};

// Expand a selection of file ids + folder ids (within one ownership scope) into
// the concrete set of ready files to archive, the full folder set to clean up
// afterwards, and a folderId → "A / B / C" path map for zip-internal paths.
// Mirrors the recursive resolution used by the delete route.
export async function resolveArchiveSource(
  scope: Scope,
  fileIds: string[],
  folderIds: string[]
) {
  const all = await loadAllFolders(scope);
  const allIds = new Set(all.map((f) => String(f._id)));
  const startFolderIds = folderIds.filter((id) => allIds.has(id));
  const folderSet = collectFolderAndDescendants(all, startFolderIds);
  const folderIdArray = [...folderSet];

  const files = await FileModel.find({
    ...scope,
    status: "ready",
    $or: [
      { _id: { $in: fileIds } },
      ...(folderIdArray.length ? [{ folderId: { $in: folderIdArray } }] : []),
    ],
  })
    .select("key filename size contentType folderId")
    .lean<SourceFile[]>();

  const pathByFolderId = new Map(
    buildFolderPaths(all).map((p) => [p.id, p.path])
  );

  const sizeBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  return {
    files,
    folderIdArray,
    pathByFolderId,
    sizeBytes,
    fileCount: files.length,
  };
}

// Folder path a file sits in, normalized for zip use: "A/B" (or "" at root).
export function folderDirOf(
  file: SourceFile,
  pathByFolderId: Map<string, string>
): string {
  const folderPath = file.folderId
    ? pathByFolderId.get(String(file.folderId)) ?? ""
    : "";
  return folderPath.replace(/\s*\/\s*/g, "/"); // "A / B" → "A/B"
}

// Full zip-internal path: "A/B/name.jpg" or "name.jpg" at root. Built from the
// stored manifest dir so the worker and the manifest never disagree.
export function zipEntryName(dir: string, filename: string): string {
  return dir ? `${dir}/${filename}` : filename;
}
