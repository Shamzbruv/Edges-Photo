import {notFound} from 'next/navigation';
import {CollectionPage} from '../../../components/work';
import {collections} from '../../../lib/editorial';
export async function generateMetadata({params}:{params:Promise<{collection:string}>}){const {collection}=await params;const c=collections.find(c=>c.slug===collection);return {title:c?`${c.label} — Edge Photos`:'Collection not found',description:c?.intro}}
export default async function Page({params}:{params:Promise<{collection:string}>}){const {collection}=await params;if(!collections.some(c=>c.slug===collection))notFound();return <CollectionPage slug={collection}/>}
