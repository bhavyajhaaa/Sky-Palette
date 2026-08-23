import {FluidColorField} from '@/components/FluidColorField';import {getSkies} from '@/lib/data';
export default async function Fluid(){const all=(await getSkies()).flatMap(s=>s.colors);return <FluidColorField colors={all}/>}
