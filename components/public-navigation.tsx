'use client';
import Link from 'next/link';
import MenuDropdown from './menu-dropdown';
import {ChevronDown,ArrowUpRight,LayoutDashboard,CalendarDays,BarChart3,Goal,Shield,Users,ClipboardList,Trophy} from 'lucide-react';
const icons={resumen:LayoutDashboard,fixture:CalendarDays,posiciones:BarChart3,goleadores:Goal,disciplina:Shield,equipos:Users,reglamento:ClipboardList,cruces:Trophy};
export default function PublicNavigation({slug,current,items,basePath}:{slug:string;current:string;items:string[][];basePath?:string}){
 const currentLabel=items.find(([id])=>id===current)?.[1]||'Resumen';const CurrentIcon=icons[current as keyof typeof icons]||LayoutDashboard;
 return <div className="public-navigation"><div className="container"><MenuDropdown className="section-picker" selection={current}><summary><span className="picker-symbol"><CurrentIcon size={21}/></span><span className="picker-title"><small>EXPLORAR TORNEO</small><strong>{currentLabel}</strong></span><span className="picker-hint">Cambiar sección</span><ChevronDown className="picker-chevron" size={20}/></summary><nav aria-label="Secciones del torneo" className="picker-options">{items.map(([id,label])=>{const Icon=icons[id as keyof typeof icons]||LayoutDashboard;return <Link key={id} href={`${basePath||`/torneos/${slug}`}${id==='resumen'?'':'/'+id}`} aria-current={id===current?'page':undefined}><Icon size={19}/><span>{label}</span><ArrowUpRight size={15}/></Link>;})}</nav></MenuDropdown></div></div>;
}
