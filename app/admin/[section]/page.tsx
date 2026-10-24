import {notFound} from 'next/navigation';
import Admin from '../../../components/admin';
const sections:Record<string,string>={bookings:'Bookings',galleries:'Galleries',payments:'Payments',settings:'Settings'};
export const metadata={title:'Studio workspace — Edge Photos',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections[section])notFound();return <Admin initialTab={sections[section]}/>}
