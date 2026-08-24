import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";
import { hasAdminPassword } from "@/lib/admin";
import { SKY_CACHE_TAGS } from "@/lib/data";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";

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

type UploadMetadata = {
  size: number | null;
  type: string | null;
  first12Ascii: string | null;
  first12Hex: string | null;
  width: number;
  height: number;
  colorCount: number | null;
  colorsMatchHex: boolean;
};

function invalid(
  code: ValidationFailure,
  message: string,
  metadata: UploadMetadata,
  status = 400,
) {
  console.warn("UPLOAD_VALIDATION_FAIL", { code, ...metadata });
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const image = form.get("image");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  let colors: unknown;
  let colorsParsed = true;
  try {
    colors = JSON.parse(String(form.get("colors")));
  } catch {
    colorsParsed = false;
  }
  const bytes =
    image instanceof File
      ? new Uint8Array(await image.arrayBuffer())
      : new Uint8Array();
  const first12 = bytes.subarray(0, 12);
  const metadata: UploadMetadata = {
    size: image instanceof File ? image.size : null,
    type: image instanceof File ? image.type : null,
    first12Ascii:
      image instanceof File
        ? Array.from(first12, (byte) =>
            byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".",
          ).join("")
        : null,
    first12Hex:
      image instanceof File
        ? Array.from(first12, (byte) => byte.toString(16).padStart(2, "0")).join(
            " ",
          )
        : null,
    width,
    height,
    colorCount: Array.isArray(colors) ? colors.length : null,
    colorsMatchHex:
      Array.isArray(colors) &&
      colors.every(
        (color) =>
          typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color),
      ),
  };
  if (!hasAdminPassword(form.get("password")))
    return invalid(
      "INVALID_PASSWORD",
      "Incorrect upload password.",
      metadata,
      401,
    );
  if (!(image instanceof File))
    return invalid("MISSING_FILE", "Invalid image.", metadata);
  if (image.type !== "image/webp")
    return invalid("INVALID_FILE_TYPE", "Invalid image.", metadata);
  if (image.size < 12 || image.size > MAX_IMAGE_BYTES)
    return invalid("INVALID_FILE_SIZE", "Invalid image.", metadata);
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
    return invalid(
      "INVALID_DIMENSIONS",
      "Invalid image dimensions.",
      metadata,
    );
  const isWebP =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (!isWebP)
    return invalid("INVALID_WEBP_SIGNATURE", "Invalid image.", metadata);
  if (!colorsParsed)
    return invalid("INVALID_COLOR_FORMAT", "Invalid color data.", metadata);
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLORS)
    return invalid("INVALID_COLOR_COUNT", "Invalid color data.", metadata);
  if (
    colors.some((c) => typeof c !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(c)) ||
    new Set(colors).size !== colors.length
  )
    return invalid("INVALID_COLOR_FORMAT", "Invalid color data.", metadata);
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
  revalidateTag(SKY_CACHE_TAGS.archive);
  revalidateTag(SKY_CACHE_TAGS.palette);
  return NextResponse.json({ sky: row.data });
}
