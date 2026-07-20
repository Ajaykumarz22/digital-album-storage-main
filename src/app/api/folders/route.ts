import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getOwnedCustomer } from "@/lib/studio";
import { resolveFolder } from "@/lib/folders";
import { Folder } from "@/models/Folder";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  const parentId = (body?.parentId as string | null | undefined) ?? null;
  const rawName = String(body?.name ?? "").trim();

  if (!customerId || !rawName) {
    return NextResponse.json(
      { error: "Missing customerId or name." },
      { status: 400 }
    );
  }
  // Folder names must not contain slashes (they are single levels).
  const name = rawName.replace(/[\/\\]/g, "").slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: "Invalid folder name." }, { status: 400 });
  }

  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parent = await resolveFolder(
    { customerId: customer._id, ownerType: "studio" },
    parentId
  );
  if (!parent.ok) {
    return NextResponse.json({ error: "Invalid parent folder." }, { status: 400 });
  }

  const actingUser = await currentUser();
  const ownerEmail =
    actingUser?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";

  await connectToDatabase();

  // Idempotent: return the existing folder if one with this name already exists
  // here (so folder drag-drop can safely "create or reuse").
  const folder = await Folder.findOneAndUpdate(
    { customerId: customer._id, parentId: parent.folderId, name, ownerType: "studio" },
    {
      $setOnInsert: {
        studioId: customer.studioId,
        customerId: customer._id,
        ownerType: "studio",
        ownerEmail,
        parentId: parent.folderId,
        name,
      },
    },
    { new: true, upsert: true }
  );

  return NextResponse.json({ folderId: String(folder._id) });
}
