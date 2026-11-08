'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Search,Trophy,Users,ArrowUpRight,ArrowRight,CalendarDays} from 'lucide-react';
import type {Tournament} from '../lib/types';
const active=(t:Tournament)=>['active','published'].includes(t.status);
const labels:Record<string,string>={published:'Próximamente',active:'En juego',finished:'Finalizado',archived:'Finalizado'};
export default function PublicTournamentList({tournaments}:{tournaments:Tournament[]}){
 const search=useSearchParams();const mode=search.get('historial')?'history':'all';
 const [query,setQuery]=useState(''),[choice,setChoice]=useState<{mode:string;value:string}>({mode,value:mode});
 const filter=choice.mode===mode?choice.value:mode;
 const choose=(value:string)=>setChoice({mode,value});
 const term=query.trim().toLocaleLowerCase('es-AR');
 const visible=tournaments.filter(t=>`${t.name} ${t.category} ${t.season}`.toLocaleLowerCase('es-AR').includes(term));
 const playing=visible.filter(active),finished=visible.filter(t=>!active(t));
 const sections=filter==='active'?[['En juego y próximos',playing] as const]:filter==='history'?[['Torneos finalizados',finished] as const]:[['En juego y próximos',playing],['Torneos finalizados',finished]] as const;
 const total=sections.reduce((n,[,ts])=>n+ts.length,0);
 return <div className="container public-directory">
  <section className="directory-heading"><div><span className="overline">LA COMPETENCIA, EN UN SOLO LUGAR</span><h1>Torneos</h1><p>Elegí un torneo para ver fechas, resultados y posiciones.</p></div><div className="directory-total"><Trophy size={20}/><strong>{tournaments.length}</strong><span>{tournaments.length===1?'torneo disponible':'torneos disponibles'}</span></div></section>
  <section className="directory-controls" aria-label="Buscar y filtrar torneos"><label className="search"><Search size={18}/><input aria-label="Buscar torneo" placeholder="Buscar por nombre, categoría o temporada" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="segmented" aria-label="Estado del torneo">{[['all','Todos'],['active','En juego'],['history','Finalizados']].map(([value,label])=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>choose(value)}>{label}</button>)}</div></section>
  <p className="directory-result" role="status">{total} {total===1?'torneo encontrado':'torneos encontrados'}{query.trim()?` para “${query.trim()}”`:''}</p>
  {sections.map(([label,ts])=>ts.length>0&&<section className="directory-section" key={label}><div className="directory-section-heading"><h2>{label}</h2><span>{ts.length}</span></div><div className="tournament-grid">{ts.map(t=><Link key={t.id} className="public-tournament-card" href={`/torneos/${t.slug}`}><div className="directory-card-top"><span className="directory-emblem"><Trophy size={26}/></span><span className={`directory-status ${active(t)?'is-active':''}`}><i/>{labels[t.status]||t.status}</span></div><div className="directory-card-body"><span className="directory-category">{t.category} · {t.season}</span><h3>{t.name}<ArrowUpRight size={19}/></h3><p>{t.description||'Consultá toda la información de la competencia.'}</p><div className="directory-card-meta"><span><Users size={14}/>{t.entrants.length} equipos</span><span><CalendarDays size={14}/>{t.matches.length} partidos</span></div></div><div className="directory-card-link">Ver torneo<ArrowRight size={17}/></div></Link>)}</div></section>)}
  {!total&&<div className="directory-empty"><Trophy size={30}/><h2>{tournaments.length?'No encontramos torneos con esos filtros':'Todavía no hay torneos publicados'}</h2><p>{tournaments.length?'Probá con otro nombre o consultá todos los torneos.':'Cuando se publique una competencia, va a aparecer acá.'}</p>{tournaments.length>0&&<button className="button secondary" onClick={()=>{setQuery('');choose('all');}}>Ver todos</button>}</div>}
 </div>;
}
