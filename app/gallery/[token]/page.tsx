export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
import ClientGallery from '../../../components/client-gallery';
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <ClientGallery token={token}/>}
