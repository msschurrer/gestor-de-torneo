'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Trophy,LayoutDashboard,Menu,X,ArrowLeft} from 'lucide-react';
const returnKey='gestor-admin-return-v1';
export default function SiteHeader({path}:{path:string[]}){
 const admin=path[0]==='admin';
 const [open,setOpen]=useState(false),[returnTo,setReturnTo]=useState('');
 const route='/'+path.join('/');
 useEffect(()=>{
  setOpen(false);
  const refresh=()=>{try{const remembered=sessionStorage.getItem(returnKey)||'';setReturnTo(/^\/admin(?:\/torneos\/[a-f0-9-]{36})?$/.test(remembered)?remembered:'');}catch{setReturnTo('');}};
  if(admin){try{sessionStorage.setItem(returnKey,/^\/admin\/torneos\/[a-f0-9-]{36}$/.test(route)?route:'/admin');}catch{/* Navigation remains available without storage. */}}
  refresh();window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);};
 },[admin,route]);
 return <header className="header"><div className="header-inner">
  <Link href={admin?'/admin':'/torneos'} className="brand" aria-label={admin?'Gestor de Torneos · Ir al panel':'Gestor de Torneos · Ver torneos'}><span className="brand-icon"><Trophy size={23}/></span><span>gestor<span className="brand-secondary"> de torneos</span><small>EL JUEGO, ORGANIZADO.</small></span></Link>
  <nav aria-label="Navegación principal" className={open?'open':''}><Link href="/torneos" onClick={()=>setOpen(false)}>Ver torneos</Link><Link href="/torneos?historial=1" onClick={()=>setOpen(false)}>Finalizados</Link></nav>
  {(admin||returnTo)&&<Link href={admin?'/admin':returnTo} className="admin-link">{admin?<LayoutDashboard size={16}/>:<ArrowLeft size={16}/>}<span>{admin?'Mi panel':'Cambiar a administración'}</span></Link>}
  <button className="menu-button icon-button" aria-label={open?'Cerrar menú':'Abrir menú'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
 </div></header>;
}
