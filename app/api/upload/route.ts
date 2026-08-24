import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";
export async function POST(req: Request) {
  const form = await req.formData();
  if (
    !process.env.SKY_UPLOAD_PASSWORD ||
    form.get("password") !== process.env.SKY_UPLOAD_PASSWORD
  )
    return NextResponse.json(
      { error: "Incorrect upload password." },
      { status: 401 },
    );
  const image = form.get("image");
  if (
    !(image instanceof File) ||
    image.type !== "image/webp" ||
    image.size > 250_000
  )
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  const width = Number(form.get("width")),
    height = Number(form.get("height"));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 600 ||
    height > 600
  )
    return NextResponse.json(
      { error: "Invalid image dimensions." },
      { status: 400 },
    );
  const bytes = new Uint8Array(await image.arrayBuffer());
  const isWebP =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (!isWebP)
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  const supabase = serverSupabase();
  if (!supabase)
    return NextResponse.json(
      { error: "Supabase is not configured yet." },
      { status: 503 },
    );
  let colors: string[];
  try {
    colors = JSON.parse(String(form.get("colors")));
  } catch {
    return NextResponse.json({ error: "Invalid color data." }, { status: 400 });
  }
  if (
    !Array.isArray(colors) ||
    colors.length < 1 ||
    colors.length > 20 ||
    colors.some((c) => typeof c !== "string" || !/^#[0-9A-F]{6}$/.test(c)) ||
    new Set(colors).size !== colors.length
  )
    return NextResponse.json({ error: "Invalid color data." }, { status: 400 });
  const id = randomUUID(),
    path = `${id}.webp`;
  const up = await supabase.storage
    .from("sky-images")
    .upload(path, bytes, { contentType: "image/webp" });
  if (up.error)
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  const row = await supabase
    .from("skies")
    .insert({
      id,
      image_path: path,
      width,
      height,
      colors,
    })
    .select()
    .single();
  if (row.error) {
    await supabase.storage.from("sky-images").remove([path]);
    return NextResponse.json({ error: row.error.message }, { status: 500 });
  }
  return NextResponse.json({ sky: row.data });
}
