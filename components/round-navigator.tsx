'use client';
import {CalendarDays,ChevronRight,ArrowLeft,CheckCircle2} from 'lucide-react';
import type {Tournament} from '../lib/types';
import {roundLabel} from '../lib/playoffs';
export default function RoundNavigator({t,value,onChange}:{t:Tournament;value:string;onChange:(r:string)=>void}){
 const rounds=[...new Set(t.matches.map(m=>m.round))].sort((a,b)=>a-b);
 if(value!=='all')return <div className="round-navigation-bar"><button className="button secondary" onClick={()=>onChange('all')}><ArrowLeft size={15}/>Todas las jornadas</button><label>Jornada<select aria-label="Jornada para cargar datos" value={value} onChange={e=>onChange(e.target.value)}>{rounds.map(r=><option value={r} key={r}>{roundLabel(t,r)}</option>)}</select></label></div>;
 return <div className="round-choice-grid">{rounds.map(r=>{const ms=t.matches.filter(m=>m.round===r),done=ms.filter(m=>m.status==='finished').length,day=t.settings.roundCalendar?.find(d=>d.round===r);return <button className="round-choice" key={r} onClick={()=>onChange(String(r))}><span className={`round-choice-icon ${done===ms.length?'complete':''}`}>{done===ms.length?<CheckCircle2 size={21}/>:<CalendarDays size={21}/>}</span><span><strong>{roundLabel(t,r)}</strong><small>{day?.date?new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z')):'Día por definir'} · {day?.startTime||t.settings.defaultStartTime||'Horario pendiente'}</small><small>{done}/{ms.length} resultados cargados</small></span><ChevronRight size={17}/></button>;})}</div>;
}
