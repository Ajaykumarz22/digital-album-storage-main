import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Folder } from "@/models/Folder";

export type FolderLite = {
  _id: mongoose.Types.ObjectId;
  name: string;
  parentId: mongoose.Types.ObjectId | null;
};

// A "scope" is the ownership filter identifying one drive space, e.g.
//   { customerId, ownerType: "studio" }   → a studio's delivery space
//   { ownerEmail, ownerType: "customer" } → a customer's own private drive
export type Scope = Record<string, unknown>;

// Load every folder in a scope (id, name, parent).
export async function loadAllFolders(scope: Scope): Promise<FolderLite[]> {
  await connectToDatabase();
  return Folder.find(scope).select("name parentId").lean<FolderLite[]>();
}

// Return the given folder ids plus all their nested descendants (as strings).
export function collectFolderAndDescendants(
  all: FolderLite[],
  startIds: string[]
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const f of all) {
    const p = f.parentId ? String(f.parentId) : "root";
    const arr = childrenByParent.get(p) ?? [];
    arr.push(String(f._id));
    childrenByParent.set(p, arr);
  }
  const result = new Set<string>();
  const stack = [...startIds];
  while (stack.length) {
    const id = stack.pop() as string;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return result;
}

// Human-readable "A / B / C" path for every folder, for the move dropdown.
export function buildFolderPaths(
  all: FolderLite[]
): { id: string; path: string }[] {
  const byId = new Map(all.map((f) => [String(f._id), f]));
  const pathOf = (id: string): string => {
    const names: string[] = [];
    let cur: string | null = id;
    for (let i = 0; i < 50 && cur; i++) {
      const f = byId.get(cur);
      if (!f) break;
      names.unshift(f.name);
      cur = f.parentId ? String(f.parentId) : null;
    }
    return names.join(" / ");
  };
  return all
    .map((f) => ({ id: String(f._id), path: pathOf(String(f._id)) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// Validate that a folderId (if given) exists within the scope.
//   - { ok: true, folderId: null }       → the root
//   - { ok: true, folderId: <id> }       → a valid in-scope folder
//   - { ok: false }                      → invalid / foreign folder
export async function resolveFolder(
  scope: Scope,
  folderId: string | null | undefined
): Promise<{ ok: true; folderId: string | null } | { ok: false }> {
  if (!folderId) return { ok: true, folderId: null };
  if (!mongoose.isValidObjectId(folderId)) return { ok: false };

  await connectToDatabase();
  const exists = await Folder.exists({ ...scope, _id: folderId });
  return exists ? { ok: true, folderId } : { ok: false };
}

// Build the path from root down to the given folder, for breadcrumbs.
export async function getBreadcrumb(
  scope: Scope,
  folderId: string | null
): Promise<{ id: string; name: string }[]> {
  if (!folderId) return [];
  await connectToDatabase();

  const all = await Folder.find(scope)
    .select("name parentId")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        name: string;
        parentId: mongoose.Types.ObjectId | null;
      }[]
    >();
  const byId = new Map(all.map((f) => [String(f._id), f]));

  const trail: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;
  for (let i = 0; i < 50 && currentId; i++) {
    const folder = byId.get(currentId);
    if (!folder) break;
    trail.unshift({ id: String(folder._id), name: folder.name });
    currentId = folder.parentId ? String(folder.parentId) : null;
  }
  return trail;
}
