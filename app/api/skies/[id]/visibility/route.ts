import { hasAdminPassword } from "@/lib/admin";
import { SKY_CACHE_TAGS } from "@/lib/data";
import { serverSupabase } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: { password?: unknown; hidden?: unknown };
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
  if (typeof body.hidden !== "boolean")
    return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
  const db = serverSupabase();
  if (!db)
    return NextResponse.json(
      { error: "Supabase is not configured yet." },
      { status: 503 },
    );
  const { id } = await params;
  const { data, error } = await db
    .from("skies")
    .update({ hidden_from_palette: body.hidden })
    .eq("id", id)
    .select("id,hidden_from_palette")
    .single();
  if (error || !data)
    return NextResponse.json({ error: "Sky not found." }, { status: 404 });
  revalidateTag(SKY_CACHE_TAGS.palette);
  revalidateTag(SKY_CACHE_TAGS.details);
  return NextResponse.json({ hidden: data.hidden_from_palette });
}
