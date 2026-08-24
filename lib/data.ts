import type { Sky, SkyColorSource } from "@/types/sky";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export const SKY_CACHE_TAGS = {
  archive: "skies:archive",
  palette: "skies:palette",
  details: "skies:details",
} as const;

export const seedSkies: Sky[] = [
  {
    id: "afterglow",
    image_path: "/seed-sky.png",
    width: 1536,
    height: 1024,
    created_at: "2026-08-23T18:34:00Z",
    hidden_from_palette: false,
    colors: [
      "#283B59",
      "#465675",
      "#686F8B",
      "#8F8496",
      "#AF8492",
      "#C57C79",
      "#D98472",
      "#EE9773",
      "#FAA56E",
      "#E2A487",
      "#B38A80",
      "#765C69",
    ],
  },
  {
    id: "violet-hour",
    image_path: "/seed-sky.png",
    width: 1024,
    height: 1280,
    created_at: "2026-08-19T12:20:00Z",
    hidden_from_palette: false,
    colors: [
      "#253A5F",
      "#495A7C",
      "#697597",
      "#8D8EA9",
      "#AC91A8",
      "#C291A5",
      "#D79AA0",
      "#E7A38F",
      "#F0B188",
      "#D5A09A",
      "#A87580",
      "#664D65",
    ],
  },
  {
    id: "apricot-east",
    image_path: "/seed-sky.png",
    width: 1200,
    height: 900,
    created_at: "2026-08-12T04:42:00Z",
    hidden_from_palette: false,
    colors: [
      "#334865",
      "#5A6680",
      "#7E8095",
      "#A198A5",
      "#C3A1A4",
      "#DFA6A0",
      "#F1AA8E",
      "#FDB274",
      "#E7906D",
      "#BF6E68",
      "#8A5965",
      "#554C61",
    ],
  },
  {
    id: "rose-weather",
    image_path: "/seed-sky.png",
    width: 900,
    height: 1200,
    created_at: "2026-08-03T14:12:00Z",
    hidden_from_palette: false,
    colors: [
      "#293D5B",
      "#4C5B78",
      "#70778D",
      "#928A9B",
      "#B48E9B",
      "#D08C8D",
      "#EB927E",
      "#F7A07A",
      "#E8B095",
      "#B98E8B",
      "#886977",
      "#5C5268",
    ],
  },
  {
    id: "low-sun",
    image_path: "/seed-sky.png",
    width: 1400,
    height: 930,
    created_at: "2026-07-26T13:55:00Z",
    hidden_from_palette: false,
    colors: [
      "#32425F",
      "#53627C",
      "#737D94",
      "#9B91A0",
      "#B9919A",
      "#D99388",
      "#EE9A77",
      "#F5A76D",
      "#E3AA8E",
      "#B6837F",
      "#805D6D",
      "#4C485F",
    ],
  },
];
function publicDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
}

function withPublicImage(db: NonNullable<ReturnType<typeof publicDatabase>>, sky: Sky) {
  return {
    ...sky,
    image_path: sky.image_path.startsWith("http")
      ? sky.image_path
      : db.storage.from("sky-images").getPublicUrl(sky.image_path).data.publicUrl,
  };
}

const getCachedSkies = unstable_cache(
  async (): Promise<Sky[]> => {
    const db = publicDatabase();
    if (!db) return seedSkies;
    const { data, error } = await db
      .from("skies")
      .select(
        "id,image_path,width,height,colors,created_at,hidden_from_palette",
      )
      .order("created_at", { ascending: false });
    if (error) return seedSkies;
    return (data as Sky[]).map((sky) => withPublicImage(db, sky));
  },
  ["skies-archive-v1"],
  { tags: [SKY_CACHE_TAGS.archive, SKY_CACHE_TAGS.details] },
);

const getCachedPaletteSkies = unstable_cache(
  async (): Promise<SkyColorSource[]> => {
    const db = publicDatabase();
    if (!db)
      return seedSkies.map(({ id, colors }) => ({ id, colors }));
    const { data, error } = await db
      .from("skies")
      .select("id,colors")
      .eq("hidden_from_palette", false)
      .order("created_at", { ascending: false });
    if (error)
      return seedSkies.map(({ id, colors }) => ({ id, colors }));
    return data as SkyColorSource[];
  },
  ["skies-palette-v1"],
  { tags: [SKY_CACHE_TAGS.palette] },
);

export function getSkies() {
  return getCachedSkies();
}

export function getPaletteSkies() {
  return getCachedPaletteSkies();
}

export async function getSky(id: string) {
  return (await getCachedSkies()).find((sky) => sky.id === id) ?? null;
}
