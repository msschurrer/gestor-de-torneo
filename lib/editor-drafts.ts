import type {Tournament} from './types';
export type EditorDraft={tournament:Tournament;step:number;names:string;dirty:boolean;savedAt:string};
const legacy={prefix:'gestor-editor-draft-v1:',inputPrefix:'gestor-editor-input-v1:',newKey:'gestor-new-draft-v1'};
function keys(accountId?:string){return accountId?{prefix:`gestor-account-draft-v2:${accountId}:`,inputPrefix:`gestor-account-input-v2:${accountId}:`,newKey:`gestor-account-new-v2:${accountId}`}:legacy;}
export function readDraft(id?:string|null,accountId?:string):EditorDraft|null{try{if(!id)return null;const d=JSON.parse(localStorage.getItem(keys(accountId).prefix+id)||'null');return d?.tournament?.id===id&&d.tournament.settings&&Array.isArray(d.tournament.entrants)&&Array.isArray(d.tournament.matches)?{...d,step:Number.isInteger(d.step)&&d.step>=0&&d.step<=10?d.step:0,names:typeof d.names==='string'?d.names:''}:null;}catch{return null;}}
export function currentNewDraftId(accountId?:string):string|null{try{return localStorage.getItem(keys(accountId).newKey);}catch{return null;}}
export function writeDraft(draft:EditorDraft,accountId?:string):boolean{try{const k=keys(accountId);localStorage.setItem(k.prefix+draft.tournament.id,JSON.stringify(draft));if(draft.tournament.version===0)localStorage.setItem(k.newKey,draft.tournament.id);return true;}catch{return false;}}
export function clearDraft(id:string,accountId?:string){try{const k=keys(accountId);localStorage.removeItem(k.prefix+id);if(currentNewDraftId(accountId)===id)localStorage.removeItem(k.newKey);}catch{}}
export function allDrafts(accountId?:string):EditorDraft[]{try{const prefix=keys(accountId).prefix;return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>readDraft(k.slice(prefix.length),accountId)).filter((d):d is EditorDraft=>!!d).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}catch{return [];}}
export function readInputDraft<T>(id:string,scope:string,accountId?:string):T|null{try{return JSON.parse(localStorage.getItem(keys(accountId).inputPrefix+id+':'+scope)||'null');}catch{return null;}}
export function writeInputDraft(id:string,scope:string,value:unknown,accountId?:string){try{localStorage.setItem(keys(accountId).inputPrefix+id+':'+scope,JSON.stringify(value));}catch{}}
export function clearInputDraft(id:string,scope:string,accountId?:string){try{localStorage.removeItem(keys(accountId).inputPrefix+id+':'+scope);}catch{}}
// Bind a store to its account so an in-flight callback cannot write into another account.
export function draftStore(accountId?:string){return {
 readDraft:(id?:string|null)=>readDraft(id,accountId),writeDraft:(draft:EditorDraft)=>writeDraft(draft,accountId),clearDraft:(id:string)=>clearDraft(id,accountId),
 currentNewDraftId:()=>currentNewDraftId(accountId),allDrafts:()=>allDrafts(accountId),startNewDraft:()=>startNewDraft(accountId),
 readInputDraft:<T>(id:string,scope:string)=>readInputDraft<T>(id,scope,accountId),writeInputDraft:(id:string,scope:string,value:unknown)=>writeInputDraft(id,scope,value,accountId),clearInputDraft:(id:string,scope:string)=>clearInputDraft(id,scope,accountId)
};}
// Three-way merge: preserve edits made while a save request was in flight.
export function mergeSavedChanges(base:unknown,latest:unknown,saved:unknown):unknown{
 if(JSON.stringify(base)===JSON.stringify(latest))return saved;
 if(Array.isArray(base)&&Array.isArray(latest)&&Array.isArray(saved)&&[...base,...latest,...saved].every(x=>x&&typeof x==='object'&&'id' in x))return latest.map(x=>{const old=base.find(b=>b.id===x.id),server=saved.find(s=>s.id===x.id);return old&&server?mergeSavedChanges(old,x,server):x;});
 if(base&&latest&&saved&&typeof base==='object'&&typeof latest==='object'&&typeof saved==='object'&&!Array.isArray(base)&&!Array.isArray(latest)&&!Array.isArray(saved)){const b=base as Record<string,unknown>,l=latest as Record<string,unknown>,s=saved as Record<string,unknown>;return Object.fromEntries([...new Set([...Object.keys(l),...Object.keys(s)])].map(k=>[k,mergeSavedChanges(b[k],l[k],s[k])]));}
 return latest;
}

export function startNewDraft(accountId?:string){try{localStorage.removeItem(keys(accountId).newKey);}catch{}}
