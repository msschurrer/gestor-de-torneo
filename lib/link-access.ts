import type {Tournament} from './types';
export type SavedAccess={id:string;key:string;name:string;role?:string};
const storage='gestor-tournament-access-v1';
export function newAccessKey(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export function savedAccesses():SavedAccess[]{try{const rows=JSON.parse(localStorage.getItem(storage)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&/^[a-f0-9]{64}$/.test(x.key)):[];}catch{return [];}}
export function rememberAccess(value:SavedAccess){localStorage.setItem(storage,JSON.stringify([value,...savedAccesses().filter(x=>x.id!==value.id)]));}
export function accessKey(id:string){return savedAccesses().find(x=>x.id===id)?.key||'';}
export function accessUrl(id:string,key:string){return `${location.origin}/admin/torneos/${id}#access=${key}`;}
export async function manage(key:string,body:Record<string,unknown>){const response=await fetch('/api/manage',{method:'POST',headers:{'Content-Type':'application/json','x-tournament-key':key},body:JSON.stringify(body),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
export async function saveWithAccess(t:Tournament){let key=accessKey(t.id);if(!key){if(t.version)throw Error('Falta tu enlace privado.');key=newAccessKey();rememberAccess({id:t.id,key,name:t.name,role:'owner'});}const data=await manage(key,{action:'save',tournament:t});rememberAccess({id:t.id,key,name:data.name,role:data.access});return data as Tournament;}
