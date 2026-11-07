import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{return{name:'Gestor de Torneos',short_name:'Torneos',description:'El juego, organizado.',start_url:'/',display:'standalone',background_color:'#f6f7f6',theme_color:'#102b24',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}}
