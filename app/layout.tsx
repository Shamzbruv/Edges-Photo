import '../components/website.css';
import VisualContent from '../components/visual-content';
import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Edge Photos — Beyond the frame',description:'Portraits, weddings and the moments in between. A photography experience by Edge Photos, Jamaica.',manifest:'/studio.webmanifest',appleWebApp:{capable:true,title:'Edge Studio',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/api/studio-icon?size=192'}};
export const viewport={themeColor:'#20271b',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<VisualContent/></body></html>}
