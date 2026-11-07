import '../components/website.css';
import VisualContent from '../components/visual-content';
import type { Metadata } from 'next';
import './globals.css';
import '../components/luxury.css';
export const metadata:Metadata={title:'Edge Photos — Wedding & Portrait Photography, Jamaica',description:'Thoughtful wedding and portrait photography in Jamaica. Explore the collections, plan your wedding photography and return to your private client gallery.',manifest:'/studio.webmanifest',appleWebApp:{capable:true,title:'Edge Studio',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/api/studio-icon?size=192'}};
export const viewport={themeColor:'#20271b',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<VisualContent/></body></html>}
