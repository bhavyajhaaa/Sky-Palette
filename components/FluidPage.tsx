import { getPaletteSkies } from "@/lib/data";
import { FluidColorField } from "./FluidColorField";

export async function FluidPage() {
  const skies = await getPaletteSkies();
  return <FluidColorField skies={skies} />;
}
