import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyEmail, customerScope } from "@/lib/portal";
import { resolveFolder } from "@/lib/folders";
import { Folder } from "@/models/Folder";

export async function POST(req: Request) {
  const email = await getMyEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parentId = (body?.parentId as string | null | undefined) ?? null;
  const name = String(body?.name ?? "")
    .trim()
    .replace(/[\/\\]/g, "")
    .slice(0, 120);

  if (!name) {
    return NextResponse.json({ error: "Invalid folder name." }, { status: 400 });
  }

  const parent = await resolveFolder(customerScope(email), parentId);
  if (!parent.ok) {
    return NextResponse.json({ error: "Invalid parent folder." }, { status: 400 });
  }

  await connectToDatabase();
  const folder = await Folder.findOneAndUpdate(
    {
      ownerType: "customer",
      ownerEmail: email,
      parentId: parent.folderId,
      name,
    },
    {
      $setOnInsert: {
        ownerType: "customer",
        ownerEmail: email,
        parentId: parent.folderId,
        name,
      },
    },
    { new: true, upsert: true }
  );

  return NextResponse.json({ folderId: String(folder._id) });
}
