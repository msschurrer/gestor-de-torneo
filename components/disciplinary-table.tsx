'use client';
import {disciplinaryTable,playerEligibility} from '../lib/sanctions';
import type {Tournament} from '../lib/types';
import {roundLabel} from '../lib/playoffs';

export default function DisciplinaryTable({t,round,onResolve}:{
 t:Tournament;round:number;
 onResolve?:(teamId:string,playerId:string,event?:{id:string;round:number;type:'red'|'second_yellow'})=>void;
}) {
 const rows = disciplinaryTable(t);
 return <div className="panel table-scroll">
  <table aria-label="Tarjetas y habilitación de jugadores">
   <thead><tr><th>Jugador</th><th>Equipo</th><th>Amarillas</th><th>Rojas directas</th><th>Doble amarilla</th><th>Estado</th>{onResolve&&<th>Resolución</th>}</tr></thead>
   <tbody>{rows.map(row=>{
    const eligible = playerEligibility(t,row.teamId,row.playerId,round);
    const accumulated = row.yellow>=t.settings.yellowLimit &&
     !(t.sanctions??[]).some(s=>s.teamId===row.teamId&&s.playerId===row.playerId&&!s.cancelled&&(s.automaticKey||s.reason.toLowerCase().startsWith('acumulación de amarillas')));
    return <tr key={row.teamId+':'+row.playerId}>
     <td><b>{row.player}</b></td><td>{row.team}</td>
     <td>{row.yellow}</td><td>{row.red}</td><td>{row.secondYellow}</td>
     <td>{!eligible.eligible ? eligible.reasons.join(' · ') : row.pending.length ? 'Expulsión por resolver' : 'Habilitado'}</td>
     {onResolve&&<td>{row.pending.map(event=><button key={event.id} type="button" className="text-link" onClick={()=>onResolve(row.teamId,row.playerId,event)}>
      Resolver {event.type==='red'?'roja':'doble amarilla'} · {roundLabel(t,event.round)}
     </button>)}{accumulated&&<button type="button" className="text-link" onClick={()=>onResolve(row.teamId,row.playerId)}>Resolver acumulación de amarillas</button>}</td>}
    </tr>;
   })}</tbody>
  </table>
  {!rows.length&&<p className="empty-inline">Todavía no hay tarjetas ni sanciones registradas.</p>}
 </div>;
}
