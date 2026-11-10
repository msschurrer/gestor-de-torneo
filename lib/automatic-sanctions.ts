import {uid,type Tournament,type Sanction} from './types';
export function automaticSanctions(t:Tournament):Tournament{
 if(!t.settings.autoYellowSanctions)return t;
 const required=new Map<string,{teamId:string;playerId:string;round:number}>();
 const counts=new Map<string,number>();
 for(const m of [...t.matches].filter(m=>m.status==='finished'&&m.published&&(m.kind!=='interzonal'||t.settings.interzonalStats)).sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id))){
  for(const e of m.events.filter(e=>!e.voided&&['yellow','second_yellow'].includes(e.type))){const player=e.teamId+':'+e.playerId;const n=(counts.get(player)||0)+1;counts.set(player,n);if(n%t.settings.yellowLimit===0)required.set(player+':'+(n/t.settings.yellowLimit),{teamId:e.teamId,playerId:e.playerId,round:m.round+1});}
 }
 const existing=t.sanctions||[],next:Sanction[]=existing.map(s=>s.automaticKey&&!required.has(s.automaticKey)?{...s,cancelled:true}:s);
 for(const[key,v]of required){if(next.some(s=>s.automaticKey===key))continue;next.push({id:uid(),automaticKey:key,teamId:v.teamId,playerId:v.playerId,kind:'games',reason:`Acumulación de ${t.settings.yellowLimit} amarillas · automática`,startRound:v.round,games:t.settings.yellowBanGames||1,servedRounds:[],amount:0,paid:false,cancelled:false});}
 return {...t,sanctions:next};
}
