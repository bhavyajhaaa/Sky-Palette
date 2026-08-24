import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGE_EDGE = 600;
const MAX_COLORS = 12;

type ValidationFailure =
  | "INVALID_PASSWORD"
  | "MISSING_FILE"
  | "INVALID_FILE_TYPE"
  | "INVALID_FILE_SIZE"
  | "INVALID_WEBP_SIGNATURE"
  | "INVALID_DIMENSIONS"
  | "INVALID_COLOR_COUNT"
  | "INVALID_COLOR_FORMAT";

function invalid(
  code: ValidationFailure,
  message: string,
  status = 400,
) {
  if (process.env.NODE_ENV === "development")
    console.warn(`[upload validation] ${code}`);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const form = await req.formData();
  if (
    !process.env.SKY_UPLOAD_PASSWORD ||
    form.get("password") !== process.env.SKY_UPLOAD_PASSWORD
  )
    return invalid("INVALID_PASSWORD", "Incorrect upload password.", 401);
  const image = form.get("image");
  if (!(image instanceof File))
    return invalid("MISSING_FILE", "Invalid image.");
  if (image.type !== "image/webp")
    return invalid("INVALID_FILE_TYPE", "Invalid image.");
  if (image.size < 12 || image.size > MAX_IMAGE_BYTES)
    return invalid("INVALID_FILE_SIZE", "Invalid image.");
  const width = Number(form.get("width")),
    height = Number(form.get("height"));
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_EDGE ||
    height > MAX_IMAGE_EDGE
  )
    return invalid("INVALID_DIMENSIONS", "Invalid image dimensions.");
  const bytes = new Uint8Array(await image.arrayBuffer());
  const isWebP =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (!isWebP)
    return invalid("INVALID_WEBP_SIGNATURE", "Invalid image.");
  let colors: string[];
  try {
    colors = JSON.parse(String(form.get("colors")));
  } catch {
    return invalid("INVALID_COLOR_FORMAT", "Invalid color data.");
  }
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLORS)
    return invalid("INVALID_COLOR_COUNT", "Invalid color data.");
  if (
    colors.some((c) => typeof c !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(c)) ||
    new Set(colors).size !== colors.length
  )
    return invalid("INVALID_COLOR_FORMAT", "Invalid color data.");
  const supabase = serverSupabase();
  if (!supabase)
    return NextResponse.json(
      { error: "Supabase is not configured yet." },
      { status: 503 },
    );
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
