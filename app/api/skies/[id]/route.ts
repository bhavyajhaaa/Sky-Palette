import { hasAdminPassword } from "@/lib/admin";
import { SKY_CACHE_TAGS } from "@/lib/data";
import { serverSupabase } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!hasAdminPassword(body.password))
    return NextResponse.json(
      { error: "Incorrect admin password." },
      { status: 401 },
    );
  const db = serverSupabase();
  if (!db)
    return NextResponse.json(
      { error: "Supabase is not configured yet." },
      { status: 503 },
    );
  const { id } = await params;
  const { data: sky, error: lookupError } = await db
    .from("skies")
    .select("id,image_path")
    .eq("id", id)
    .single();
  if (lookupError || !sky)
    return NextResponse.json({ error: "Sky not found." }, { status: 404 });
  const storagePath = sky.image_path;
  if (
    typeof storagePath !== "string" ||
    !storagePath ||
    storagePath.startsWith("http") ||
    storagePath.startsWith("/") ||
    storagePath.includes("..")
  )
    return NextResponse.json(
      { error: "This sky has no canonical storage path." },
      { status: 409 },
    );
  const { error: storageError } = await db.storage
    .from("sky-images")
    .remove([storagePath]);
  if (storageError) {
    console.error("SKY_DELETE_STORAGE_FAIL", { id, storagePath });
    return NextResponse.json(
      { error: "The stored image could not be removed." },
      { status: 500 },
    );
  }
  const { data: deleted, error: deleteError } = await db
    .from("skies")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (deleteError || !deleted) {
    console.error("SKY_DELETE_ROW_FAIL_AFTER_STORAGE", { id, storagePath });
    return NextResponse.json(
      { error: "The image was removed, but the database record remains." },
      { status: 500 },
    );
  }
  revalidateTag(SKY_CACHE_TAGS.archive);
  revalidateTag(SKY_CACHE_TAGS.palette);
  revalidateTag(SKY_CACHE_TAGS.details);
  return NextResponse.json({ deleted: true });
}
