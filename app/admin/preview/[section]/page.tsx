import {notFound} from 'next/navigation';
import Admin from '../../../../components/admin';
const sections:Record<string,string>={bookings:'Bookings',galleries:'Galleries',payments:'Payments',settings:'Settings'};
export const metadata={title:'Workspace tour — Edge Photos',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections[section])notFound();return <Admin preview initialTab={sections[section]}/>}
