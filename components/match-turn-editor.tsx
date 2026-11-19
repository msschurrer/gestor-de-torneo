'use client';
import {useState} from 'react';
import {roundSlots} from '../lib/engine';
import {canChangeTurn, changeFixtureTurn} from '../lib/fixture-turns';
import type {Match, Tournament} from '../lib/types';

export default function MatchTurnEditor({t,match,busy,onChange}:{
 t:Tournament;match:Match;busy:boolean;onChange:(matches:Match[])=>void;
}) {
 const [selected,setSelected] = useState('');
 const [error,setError] = useState('');
 if (!canChangeTurn(match)) return null;
 const round = t.matches.filter(other=>other.round===match.round);
 const slots = roundSlots(t.settings,match.round,t.matches);
 const free = slots.map((time,slot)=>({time,slot})).filter(({slot})=>!round.some(other=>other.pitch===match.pitch&&other.slot===slot));
 const exchanges = round.filter(other=>other.kind===match.kind&&other.group===match.group&&other.slot!==match.slot&&canChangeTurn(other))
  .sort((a,b)=>a.slot-b.slot);
 const team = (id:string)=>t.entrants.find(entrant=>entrant.id===id)?.name||'Equipo';
 function apply() {
  setError('');
  try {
   const target = selected.startsWith('swap:') ? {matchId:selected.slice(5)} : {slot:Number(selected.slice(5))};
   onChange(changeFixtureTurn(t,match.id,target));
   setSelected('');
  } catch (cause) {
   setError(cause instanceof Error?cause.message:'No se pudo cambiar el turno.');
  }
 }
 return <details className="admin-fixture-tools">
  <summary>Cambiar turno</summary>
  {!free.length&&!exchanges.length ? <p className="muted">No hay turnos libres ni partidos disponibles para intercambiar en esta zona.</p> :
   <div className="inline wrap">
    <label>Nuevo turno
     <select value={selected} disabled={busy} onChange={event=>{setSelected(event.target.value);setError('');}}>
      <option value="">Elegí un turno o un intercambio</option>
      {free.length>0&&<optgroup label={'Turnos libres en '+match.pitch}>{free.map(({time,slot})=><option key={slot} value={'slot:'+slot}>{time}</option>)}</optgroup>}
      {exchanges.length>0&&<optgroup label="Intercambiar con un partido de la misma zona">{exchanges.map(other=><option key={other.id} value={'swap:'+other.id}>{slots[other.slot]} · {team(other.home)} vs {team(other.away)} · {other.pitch}</option>)}</optgroup>}
     </select>
    </label>
    <button type="button" className="button secondary" disabled={!selected||busy} onClick={apply}>Aplicar cambio</button>
   </div>}
  {error&&<p role="alert" className="inline-score-error">{error}</p>}
 </details>;
}
