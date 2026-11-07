import { Entrant, Match, Settings, Tournament } from './types';
// Pairing and resource allocation are intentionally independent pure engines.
const hash = (s:string) => {let h=2166136261; for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0;};
function stableId(s:string){const h=[0,1,2,3].map(i=>hash(s+':'+i).toString(16).padStart(8,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;}
export function pairings(entrants:Entrant[],s:Settings):Match[]{
 const groups=Array.from({length:s.groups},(_,g)=>entrants.filter(t=>t.group===g).map(t=>t.id));
 if(groups.some(g=>g.length<2))throw Error('Cada zona necesita al menos 2 equipos.');
 const schedules=groups.map(ids=>{const a:(string|null)[]=[...ids];if(a.length%2)a.push(null);const rounds:{pairs:string[][];bye:string|null}[]=[];for(let r=0;r<a.length-1;r++){const pairs:string[][]=[];let bye:string|null=null;for(let i=0;i<a.length/2;i++){const x=a[i],y=a[a.length-1-i];if(!x||!y)bye=x||y;else pairs.push(r%2?[y,x]:[x,y]);}rounds.push({pairs,bye});a.splice(1,0,a.pop()!);}return rounds;});
 const rounds=Math.max(...schedules.map(g=>g.length));const result:Match[]=[];const used=new Map<string,number>();
 function add(home:string,away:string,round:number,group:number|null,kind:Match['kind']){result.push({id:stableId(`${s.seed}:${home}:${away}:${round}:${kind}`),home,away,round,group,kind,pitch:'',slot:-1,startsAt:'',status:'scheduled',homeScore:null,awayScore:null,locked:false,events:[],note:'',published:false});}
 for(let leg=0;leg<s.legs;leg++)for(let r=0;r<rounds;r++){
 const byes:{id:string;group:number}[]=[];
 schedules.forEach((rs,g)=>{const rr=rs[r];if(!rr){groups[g].forEach(id=>byes.push({id,group:g}));return;}rr.pairs.forEach(([a,b])=>add(leg%2?b:a,leg%2?a:b,leg*rounds+r+1,g,'internal'));if(rr.bye)byes.push({id:rr.bye,group:g});});
 if(s.interzonal)while(byes.length>1){const a=byes.shift()!;const options=byes.map((b,i)=>({b,i,key:[a.id,b.id].sort().join(':'),cost:b.group===a.group?Infinity:(used.get([a.id,b.id].sort().join(':'))||0)})).sort((x,y)=>x.cost-y.cost||hash(x.key+s.seed)-hash(y.key+s.seed));if(!Number.isFinite(options[0].cost))continue;const b=byes.splice(options[0].i,1)[0];used.set(options[0].key,options[0].cost+1);add(a.id,b.id,leg*rounds+r+1,null,'interzonal');}
 }
 return result;
}
function dateAt(s:Settings,round:number,slot:number){const date=new Date(`${s.startDate}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+(round-1)*s.intervalDays); // MVP supports Argentina UTC-3; other zones explicitly rejected by validation.
 return `${date.toISOString().slice(0,10)}T${s.slots[slot]}:00-03:00`;}
export function schedule(input:Match[],s:Settings):{matches:Match[];warnings:string[];penalty:number}{
 const matches=structuredClone(input), warnings:string[]=[];let penalty=0;
 const history=new Map<string,{slots:number[];pitches:Record<string,number>;last:number}>();
 const get=(id:string)=>{if(!history.has(id))history.set(id,{slots:s.slots.map(()=>0),pitches:{},last:-1});return history.get(id)!;};
 for(const round of [...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b)){
 const ms=matches.filter(m=>m.round===round),occupied=new Set<string>();
 for(const m of ms.filter(m=>m.locked)){if(!s.pitches.includes(m.pitch)||m.slot<0||m.slot>=s.slots.length)throw Error('Un partido bloqueado no tiene cancha/turno válido.');const key=`${m.pitch}:${m.slot}`;if(occupied.has(key))throw Error('Conflicto entre partidos bloqueados.');occupied.add(key);}
 const pending=ms.filter(m=>!m.locked).sort((a,b)=>{const urgency=(m:Match)=>[m.home,m.away].filter(id=>get(id).last===s.slots.length-1).length;return urgency(b)-urgency(a)||hash(a.id+s.seed)-hash(b.id+s.seed);});
 for(const m of pending){let best:{pitch:string;slot:number;cost:number}|null=null;
 for(let slot=0;slot<s.slots.length;slot++)for(let pi=0;pi<s.pitches.length;pi++){const pitch=s.pitches[pi];if(occupied.has(`${pitch}:${slot}`))continue;let cost=0;for(const id of [m.home,m.away]){const h=get(id);cost+=h.slots[slot]*12+(h.pitches[pitch]||0)*3;if(h.last===s.slots.length-1)cost+=slot>1?150:slot*3;if(h.last===slot)cost+=8;}
 if(s.mode==='rotation'&&m.group!==null&&pi!==(m.group+round-1)%s.pitches.length)cost+=200;
 cost+=slot*0.1+(hash(m.id+pitch+slot+s.seed)%100)/10000;
 if(!best||cost<best.cost)best={pitch,slot,cost};}
 if(!best)throw Error(`Fecha ${round}: no hay capacidad. Agregá turnos o canchas.`);
 m.pitch=best.pitch;m.slot=best.slot;m.startsAt=new Date(dateAt(s,round,m.slot)).toISOString();occupied.add(`${m.pitch}:${m.slot}`);penalty+=best.cost;
 if(s.mode==='rotation'&&m.group!==null&&s.pitches.indexOf(m.pitch)!==(m.group+round-1)%s.pitches.length)warnings.push(`Fecha ${round}: ${m.home} requiere una excepción de rotación.`);
 }
 for(const m of ms)for(const id of [m.home,m.away]){const h=get(id);h.slots[m.slot]++;h.pitches[m.pitch]=(h.pitches[m.pitch]||0)+1;h.last=m.slot;}
 }
 const errors=validateFixture(matches,s);if(errors.length)throw Error(errors.join(' '));return{matches,warnings,penalty:Math.round(penalty)};
}
export function validateFixture(matches:Match[],s:Settings){const errors:string[]=[];const seen=new Set<string>();for(const m of matches){if(m.home===m.away)errors.push('Un equipo no puede jugar contra sí mismo.');for(const id of [m.home,m.away]){const k=`${m.round}:${id}`;if(seen.has(k))errors.push(`Equipo programado dos veces en fecha ${m.round}.`);seen.add(k);}if(!m.startsAt||!s.pitches.includes(m.pitch)||m.slot<0||m.slot>=s.slots.length)errors.push('Hay partidos sin programación.');else if(!Number.isFinite(Date.parse(m.startsAt))||Date.parse(m.startsAt)!==Date.parse(dateAt(s,m.round,m.slot)))errors.push('Partido fuera de la disponibilidad configurada.');}
 for(let i=0;i<matches.length;i++)for(let j=i+1;j<matches.length;j++){const a=matches[i],b=matches[j];if(a.pitch===b.pitch||[a.home,a.away].some(t=>t===b.home||t===b.away)){const diff=Math.abs(Date.parse(a.startsAt)-Date.parse(b.startsAt))/60000;if(diff<s.duration+s.buffer)errors.push('Superposición de partidos o buffer insuficiente.');}}
 return [...new Set(errors)];}
export function standings(t:Tournament){const rows=t.entrants.map(e=>({id:e.id,name:e.name,group:e.group,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,difference:0,points:0,ppg:0}));for(const m of t.matches){if(m.status!=='finished'||!m.published||m.homeScore===null||m.awayScore===null||(m.kind==='interzonal'&&!t.settings.interzonalPoints))continue;for(const home of [true,false]){const r=rows.find(r=>r.id===(home?m.home:m.away));if(!r)continue;const gf=home?m.homeScore:m.awayScore,ga=home?m.awayScore:m.homeScore;r.played++;r.gf+=gf;r.ga+=ga;r.difference=r.gf-r.ga;if(gf>ga){r.won++;r.points+=t.settings.win;}else if(gf===ga){r.drawn++;r.points+=t.settings.draw;}else{r.lost++;r.points+=t.settings.loss;}r.ppg=r.points/r.played;}}
 return rows.sort((a,b)=>{if(a.group!==b.group)return a.group-b.group;for(const criterion of t.settings.tieBreakers){if(criterion==='headToHead'){const head=(id:string,opponent:string)=>t.matches.filter(m=>m.status==='finished'&&m.published&&((m.home===id&&m.away===opponent)||(m.home===opponent&&m.away===id))&&(m.kind!=='interzonal'||t.settings.interzonalPoints)).reduce((p,m)=>{const own=m.home===id?m.homeScore!:m.awayScore!,other=m.home===id?m.awayScore!:m.homeScore!;return p+(own>other?t.settings.win:own===other?t.settings.draw:t.settings.loss);},0);const d=head(b.id,a.id)-head(a.id,b.id);if(d)return d;}else{const k=criterion==='goals'?'gf':criterion;const d=b[k]-a[k];if(d)return d;}}return a.name.localeCompare(b.name);});}
export function rankings(t:Tournament){const rows=t.entrants.flatMap(e=>e.players.map(p=>({id:p.id,entrantId:e.id,name:p.name,team:e.name,goals:0,yellow:0,red:0})));for(const m of t.matches.filter(m=>m.status==='finished'&&m.published&&(m.kind!=='interzonal'||t.settings.interzonalStats)))for(const e of m.events.filter(e=>!e.voided)){const row=rows.find(p=>p.id===e.playerId&&p.entrantId===e.teamId);if(!row)continue;if(e.type==='goal')row.goals++;if(e.type==='yellow'||e.type==='second_yellow')row.yellow++;if(e.type==='red'||e.type==='second_yellow')row.red++;}return rows;}
export function equity(t:Tournament){return t.entrants.map(e=>{const ms=t.matches.filter(m=>m.home===e.id||m.away===e.id).sort((a,b)=>a.round-b.round);return{team:e.name,played:ms.length,first:ms.filter(m=>m.slot===0).length,second:ms.filter(m=>m.slot===1).length,last:ms.filter(m=>m.slot===t.settings.slots.length-1).length,repeatedLast:ms.filter((m,i)=>i>0&&m.slot===t.settings.slots.length-1&&ms[i-1].slot===m.slot).length,pitches:t.settings.pitches.map(p=>({name:p,count:ms.filter(m=>m.pitch===p).length}))};});}
