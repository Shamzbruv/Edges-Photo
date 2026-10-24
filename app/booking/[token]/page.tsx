export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
import ClientBooking from '../../../components/client-booking';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <ClientBooking token={token}/>}
