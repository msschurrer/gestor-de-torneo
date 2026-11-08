import type {Tournament,Match} from './types';
export function applyMatchInfo(t:Tournament,id:string,info:Pick<Match,'events'|'note'>):Tournament{return {...t,matches:t.matches.map(m=>m.id===id?{...m,events:info.events,note:info.note}:m)};}
