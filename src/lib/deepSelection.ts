import { connectToDatabase } from "@/lib/mongodb";
import { buildFolderPaths, type FolderLite } from "@/lib/folders";
import { Folder } from "@/models/Folder";

// Match a customer's OWN folders plus the studio-shared delivery folders.
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
