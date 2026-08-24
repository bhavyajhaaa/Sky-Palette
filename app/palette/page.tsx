import { PaletteGrid } from '@/components/PaletteGrid';
import { getSkies } from '@/lib/data';

export default async function Palette(){
 const skies=await getSkies();
 return <PaletteGrid colors={skies.flatMap(sky=>sky.colors)} skies={skies.length}/>;
}
