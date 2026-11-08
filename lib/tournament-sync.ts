import type {Tournament} from './types';
export const PUBLIC_REFRESH_EVENT='gestor-public-data-changed';
export const PUBLIC_REFRESH_KEY='gestor-public-refresh-v1';
export const PUBLIC_REFRESH_MS=15000;
// Saving an already published competition also publishes its updated fixtures.
// Drafts and tournament privacy remain explicit administrator choices.
export function prepareTournamentSave(t:Tournament):Tournament{return t.status==='draft'?t:{...t,matches:t.matches.map(m=>({...m,published:true}))};}
export function announceTournamentSaved(t:Pick<Tournament,'id'|'version'>){if(typeof window==='undefined')return;window.dispatchEvent(new Event(PUBLIC_REFRESH_EVENT));try{localStorage.setItem(PUBLIC_REFRESH_KEY,JSON.stringify({id:t.id,version:t.version,at:Date.now()}));}catch{}}
