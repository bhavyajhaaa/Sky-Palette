import {ArchiveGrid} from '@/components/ArchiveGrid';import {getSkies} from '@/lib/data';export default async function Archive(){return <ArchiveGrid skies={await getSkies()}/>}
