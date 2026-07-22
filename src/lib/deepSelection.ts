import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { buildFolderPaths, type FolderLite } from "@/lib/folders";
import { Folder } from "@/models/Folder";
import { FileModel } from "@/models/File";

export type SelectedFile = {
  _id: mongoose.Types.ObjectId;
  key: string;
  filename: string;
  size: number;
  contentType: string;
  folderId: mongoose.Types.ObjectId | null;
  ownerType: string;
  customerId: mongoose.Types.ObjectId | null;
};

// Match a customer's OWN files plus the studio-shared files delivered to them.
// (Studio files are per-delivery, so deepStatus on them is unambiguous.)
function ownerFilter(accountId: string, customerIds: string[]) {
  return {
    $or: [
      { ownerType: "customer" as const, ownerAccountId: accountId },
      ...(customerIds.length
        ? [{ ownerType: "studio" as const, customerId: { $in: customerIds } }]
        : []),
    ],
  };
}

// All files the customer has tagged "selected for cold drive".
export async function getSelectedDeepFiles(
  accountId: string,
  customerIds: string[]
): Promise<SelectedFile[]> {
  await connectToDatabase();
  return FileModel.find({
    deepStatus: "selected",
    ...ownerFilter(accountId, customerIds),
  })
    .select("key filename size contentType folderId ownerType customerId")
    .lean<SelectedFile[]>();
}

// folderId → "A/B" path across BOTH the customer's own folders and the studio
// delivery folders, so zip entries keep their structure and avoid name clashes.
export async function folderPathMap(
  accountId: string,
  customerIds: string[]
): Promise<Map<string, string>> {
  await connectToDatabase();
  const folders = await Folder.find(ownerFilter(accountId, customerIds))
    .select("name parentId")
    .lean<FolderLite[]>();
  return new Map(
    buildFolderPaths(folders).map((p) => [p.id, p.path.replace(/\s*\/\s*/g, "/")])
  );
}
