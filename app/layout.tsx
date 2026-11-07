import type { Metadata,Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Gestor de Torneos | El juego, organizado.',description:'Fixture, resultados y estadísticas de tus torneos de fútbol. Toda la pasión, en un solo lugar.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Torneos',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#102b24'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-AR"><body>{children}</body></html>}
