import {FluidColorField} from '@/components/FluidColorField';import {getSkies} from '@/lib/data';
export default async function Fluid(){const all=(await getSkies()).flatMap(s=>s.colors),chosen=all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/32))===0).slice(0,32);return <FluidColorField colors={chosen}/>}
