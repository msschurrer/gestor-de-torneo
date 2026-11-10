import type {Tournament,Match} from './types';
// Goal events are authoritative when goals are added, corrected or removed.
// Saving the match still confirms its sporting result from the main score form.
export function applyMatchInfo(t:Tournament,id:string,info:Pick<Match,'events'|'note'>):Tournament{return {...t,matches:t.matches.map(m=>{
 if(m.id!==id)return m;
 const goals=(events:Match['events'])=>events.filter(e=>!e.voided&&['goal','own_goal'].includes(e.type));
 const before=goals(m.events),after=goals(info.events);
 if(JSON.stringify(before)===JSON.stringify(after))return {...m,events:info.events,note:info.note};
 const score=(teamId:string)=>after.filter(e=>e.type==='goal'?e.teamId===teamId:e.teamId!==teamId).length;
 return {...m,events:info.events,note:info.note,homeScore:score(m.home),awayScore:score(m.away)};
})};}
