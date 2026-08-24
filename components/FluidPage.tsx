import { getSkies } from "@/lib/data";
import { FluidColorField } from "./FluidColorField";

export async function FluidPage() {
  const skies = await getSkies();
  return <FluidColorField colors={skies.flatMap((sky) => sky.colors)} />;
}
