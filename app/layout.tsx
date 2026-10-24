import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Edge Photos — Beyond the frame',description:'Portraits, weddings and the moments in between. A photography experience by Edge Photos, Jamaica.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
