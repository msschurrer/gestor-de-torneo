import type {Tournament,Sanction} from './types';
export const sanctionKinds={ban:'Expulsión del torneo',games:'Suspensión por fechas',fine:'Inhabilitado hasta pagar multa',redeemable:'Suspensión con opción de pagar multa'};
export function sanctionState(s:Sanction,round:number){if(s.cancelled)return 'Anulada';if(round<s.startRound)return 'Pendiente de inicio';if(s.kind==='ban')return 'Expulsado del torneo';const paid=s.paid&&s.paidAfterRound!==undefined&&round>s.paidAfterRound;if(s.kind==='fine')return paid?'Habilitado por pago':'Inhabilitado por multa pendiente';if(s.reinstatedRound!==undefined&&round>=s.reinstatedRound)return 'Habilitado por resolución';const served=s.servedRounds.filter(r=>r<round).length;if(served>=s.games)return 'Cumplida';if(s.kind==='redeemable'&&paid)return 'Habilitado por pago';return `Suspendido · ${s.games-served} fecha(s) pendientes`;}
export function playerEligibility(t:Tournament,teamId:string,playerId:string,round:number){const active=(t.sanctions||[]).filter(s=>s.teamId===teamId&&s.playerId===playerId).map(s=>sanctionState(withCompletedRounds(t,s),round)).filter(s=>s==='Expulsado del torneo'||s.startsWith('Inhabilitado')||s.startsWith('Suspendido'));return {eligible:active.length===0,reasons:active};}

export function returnToPlay(s:Sanction) {
 if (s.cancelled) return 'Sanción anulada';
 if (s.kind==='ban') return 'Sin regreso · expulsión del torneo';
 const possible: number[] = [];
 if ((s.kind==='fine'||s.kind==='redeemable')&&s.paid&&s.paidAfterRound!==undefined) {
  possible.push(Math.max(s.startRound,s.paidAfterRound+1));
 }
 if (s.kind==='fine'&&!possible.length) return 'Regreso pendiente de pago';
 if (s.reinstatedRound!==undefined) possible.push(s.reinstatedRound);
 if (s.kind!=='fine'&&s.games>0&&s.servedRounds.length>=s.games) {
  possible.push([...s.servedRounds].sort((a,b)=>a-b)[s.games-1]+1);
 }
 if (possible.length) return `Puede volver desde la fecha ${Math.min(...possible)}`;
 return `Regreso pendiente · faltan ${Math.max(0,s.games-s.servedRounds.length)} fecha(s)`;
}

/** Count completed matches of the player's team, including existing manual confirmations. */
export function withCompletedRounds(tournament: Tournament, sanction: Sanction): Sanction {
 if (sanction.kind !== 'games' && sanction.kind !== 'redeemable') return sanction;
 const completed = new Set(sanction.servedRounds);
 for (const match of tournament.matches) {
  if (match.status !== 'finished' || !match.published || match.round < sanction.startRound) continue;
  if (match.home !== sanction.teamId && match.away !== sanction.teamId) continue;
  if (match.events.some(event=>!event.voided && event.teamId===sanction.teamId && event.playerId===sanction.playerId)) continue;
  completed.add(match.round);
 }
 return {...sanction,servedRounds:[...completed].sort((a,b)=>a-b).slice(0,sanction.games)};
}

export function disciplinaryTable(tournament: Tournament, includePendingMatches = false) {
 const cards = new Map<string,{yellow:number;red:number;secondYellow:number;expulsions:{id:string;round:number;type:'red'|'second_yellow'}[]}>();
 const sanctions = new Map<string,Sanction[]>();
 for (const sanction of tournament.sanctions ?? []) {
  const key = sanction.teamId+':'+sanction.playerId;
  const rows = sanctions.get(key) ?? [];
  rows.push(sanction);
  sanctions.set(key,rows);
 }
 for (const match of tournament.matches) {
  if (!includePendingMatches && (!match.published || match.status !== 'finished')) continue;
  for (const event of match.events) {
   if (event.voided || event.type==='goal' || event.type==='own_goal') continue;
   const key = event.teamId+':'+event.playerId;
   const row = cards.get(key) ?? {yellow:0,red:0,secondYellow:0,expulsions:[]};
   if (event.type==='yellow') row.yellow++;
   if (event.type==='red') row.red++;
   if (event.type==='second_yellow') { row.yellow++; row.secondYellow++; }
   if (event.type !== 'yellow') row.expulsions.push({id:event.id,round:match.round,type:event.type});
   cards.set(key,row);
  }
 }
 return tournament.entrants.flatMap(team=>team.players.flatMap(player=>{
  const key = team.id+':'+player.id;
  const playerCards = cards.get(key);
  const resolutions = sanctions.get(key) ?? [];
  if (!playerCards && !resolutions.length) return [];
  return [{teamId:team.id,team:team.name,playerId:player.id,player:player.name,
   yellow:playerCards?.yellow ?? 0,red:playerCards?.red ?? 0,secondYellow:playerCards?.secondYellow ?? 0,
   pending:playerCards?.expulsions.filter(event=>!resolutions.some(s=>!s.cancelled&&s.sourceEventId===event.id)) ?? []}];
 })).sort((a,b)=>(b.red+b.secondYellow)-(a.red+a.secondYellow)||b.yellow-a.yellow||a.player.localeCompare(b.player,'es'));
}
