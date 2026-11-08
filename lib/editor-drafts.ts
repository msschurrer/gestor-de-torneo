import type {Tournament} from './types';
export type EditorDraft={tournament:Tournament;step:number;names:string;dirty:boolean;savedAt:string};
const prefix='gestor-editor-draft-v1:',inputPrefix='gestor-editor-input-v1:',newKey='gestor-new-draft-v1';
export function readDraft(id?:string|null):EditorDraft|null{try{if(!id)return null;const d=JSON.parse(localStorage.getItem(prefix+id)||'null');return d?.tournament?.id===id&&d.tournament.settings&&Array.isArray(d.tournament.entrants)&&Array.isArray(d.tournament.matches)?{...d,step:Number.isInteger(d.step)&&d.step>=0&&d.step<=4?d.step:0,names:typeof d.names==='string'?d.names:''}:null;}catch{return null;}}
export function currentNewDraftId():string|null{try{return localStorage.getItem(newKey);}catch{return null;}}
export function writeDraft(draft:EditorDraft):boolean{try{localStorage.setItem(prefix+draft.tournament.id,JSON.stringify(draft));if(draft.tournament.version===0)localStorage.setItem(newKey,draft.tournament.id);return true;}catch{return false;}}
export function clearDraft(id:string){try{localStorage.removeItem(prefix+id);if(currentNewDraftId()===id)localStorage.removeItem(newKey);}catch{}}
export function allDrafts():EditorDraft[]{try{return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>readDraft(k.slice(prefix.length))).filter((d):d is EditorDraft=>!!d).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}catch{return [];}}
export function readInputDraft<T>(id:string,scope:string):T|null{try{return JSON.parse(localStorage.getItem(inputPrefix+id+':'+scope)||'null');}catch{return null;}}
export function writeInputDraft(id:string,scope:string,value:unknown){try{localStorage.setItem(inputPrefix+id+':'+scope,JSON.stringify(value));}catch{}}
export function clearInputDraft(id:string,scope:string){try{localStorage.removeItem(inputPrefix+id+':'+scope);}catch{}}
// Three-way merge: preserve edits made while a save request was in flight.
export function mergeSavedChanges(base:unknown,latest:unknown,saved:unknown):unknown{
 if(JSON.stringify(base)===JSON.stringify(latest))return saved;
 if(Array.isArray(base)&&Array.isArray(latest)&&Array.isArray(saved)&&[...base,...latest,...saved].every(x=>x&&typeof x==='object'&&'id' in x))return latest.map(x=>{const old=base.find(b=>b.id===x.id),server=saved.find(s=>s.id===x.id);return old&&server?mergeSavedChanges(old,x,server):x;});
 if(base&&latest&&saved&&typeof base==='object'&&typeof latest==='object'&&typeof saved==='object'&&!Array.isArray(base)&&!Array.isArray(latest)&&!Array.isArray(saved)){const b=base as Record<string,unknown>,l=latest as Record<string,unknown>,s=saved as Record<string,unknown>;return Object.fromEntries([...new Set([...Object.keys(l),...Object.keys(s)])].map(k=>[k,mergeSavedChanges(b[k],l[k],s[k])]));}
 return latest;
}

export function startNewDraft(){try{localStorage.removeItem(newKey);}catch{}}
