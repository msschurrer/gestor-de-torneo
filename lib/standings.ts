import type {Tournament,Match} from './types';
import type {StandingCriterion} from './standings-rules';
const eligible=(t:Tournament,m:Match)=>m.kind!=='playoff'&&m.status==='finished'&&m.published&&m.homeScore!==null&&m.awayScore!==null&&(m.kind!=='interzonal'||t.settings.interzonalPoints);
export function standings(t:Tournament,overall=false){
 const matches=t.matches.filter(m=>eligible(t,m));
 const rows=t.entrants.map(e=>({id:e.id,name:e.name,group:e.group,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,difference:0,points:0,ppg:0,yellow:0,red:0,fairPlay:0,winPercentage:0,goalRatio:0}));
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const m of matches)for(const home of [true,false]){
  const r=byId.get(home?m.home:m.away);if(!r)continue;
  const gf=(home?m.homeScore:m.awayScore)!,ga=(home?m.awayScore:m.homeScore)!;
  r.played++;r.gf+=gf;r.ga+=ga;r.difference=r.gf-r.ga;
  if(gf>ga){r.won++;r.points+=t.settings.win;}else if(gf===ga){r.drawn++;r.points+=t.settings.draw;}else{r.lost++;r.points+=t.settings.loss;}
  for(const e of m.events)if(!e.voided&&e.teamId===r.id){if(e.type==='yellow'||e.type==='second_yellow')r.yellow++;if(e.type==='red'||e.type==='second_yellow')r.red++;}
  r.ppg=r.points/r.played;r.fairPlay=r.yellow+3*r.red;r.winPercentage=r.won/r.played;r.goalRatio=r.ga?r.gf/r.ga:r.gf?Infinity:0;
 }
 // Public discipline may be redacted. Publish only the final order, never hidden card details.
 const persisted=overall?t.settings.publicOverallOrder:t.settings.publicStandingsOrder;
 if(t.access==='viewer'&&persisted&&persisted.length===rows.length&&new Set(persisted).size===rows.length&&persisted.every(id=>byId.has(id)))return persisted.map(id=>byId.get(id)!);
 type Row=typeof rows[number];
 const criteria:StandingCriterion[]=overall&&!t.settings.customStandings?['ppg','points','difference','goals']:t.settings.tieBreakers;
 function rank(cohort:Row[],index:number):Row[]{
  if(cohort.length<2||index>=criteria.length)return [...cohort].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const criterion=criteria[index],mini=new Map<string,number>();
  if(criterion==='headToHead'){
   const ids=new Set(cohort.map(r=>r.id));for(const m of matches)if(ids.has(m.home)&&ids.has(m.away)){
    mini.set(m.home,(mini.get(m.home)||0)+(m.homeScore!>m.awayScore!?t.settings.win:m.homeScore===m.awayScore?t.settings.draw:t.settings.loss));
    mini.set(m.away,(mini.get(m.away)||0)+(m.awayScore!>m.homeScore!?t.settings.win:m.homeScore===m.awayScore?t.settings.draw:t.settings.loss));
   }
  }
  const value=(r:Row):number=>criterion==='headToHead'?(mini.get(r.id)||0):criterion==='draw'?(t.settings.lotOrder?.includes(r.id)?-t.settings.lotOrder.indexOf(r.id):-Infinity):criterion==='goals'?r.gf:criterion==='goalsAgainst'?-r.ga:['lost','yellow','red','fairPlay'].includes(criterion)?-r[criterion as 'lost'|'yellow'|'red'|'fairPlay']:r[criterion as 'points'|'difference'|'won'|'ppg'|'winPercentage'|'goalRatio'];
  const sorted=[...cohort].sort((a,b)=>value(a)===value(b)?0:value(a)>value(b)?-1:1);
  const buckets:Row[][]=[];for(const r of sorted){const last=buckets.at(-1);if(last&&value(last[0])===value(r))last.push(r);else buckets.push([r]);}
  return buckets.flatMap(bucket=>rank(bucket,index+1));
 }
 return overall?rank(rows,0):[...new Set(rows.map(r=>r.group))].sort((a,b)=>a-b).flatMap(g=>rank(rows.filter(r=>r.group===g),0));
}
