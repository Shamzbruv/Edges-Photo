import '../components/website.css';
import VisualContent from '../components/visual-content';
import type { Metadata } from 'next';
import './globals.css';
import '../components/luxury.css';
export const metadata:Metadata={title:'Edge Photos — Wedding & Portrait Photography, Jamaica',description:'Thoughtful wedding and portrait photography in Jamaica. Explore the collections, plan your wedding photography and return to your private client gallery.',manifest:'/studio.webmanifest',appleWebApp:{capable:true,title:'D&T Studio',statusBarStyle:'default'},icons:{icon:'/favicon.svg?v=dt1',apple:'/api/studio-icon?size=192&v=dt1'}};
export const viewport={themeColor:'#302b26',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<VisualContent/></body></html>}
