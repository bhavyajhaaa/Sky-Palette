import { PaletteGrid } from "@/components/PaletteGrid";
import { getPaletteSkies } from "@/lib/data";

export default async function Palette() {
  const skies = await getPaletteSkies();
  return <PaletteGrid skies={skies} />;
}
