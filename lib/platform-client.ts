import {browserDb} from './supabase';
import type {Tournament} from './types';
import {announceTournamentSaved,prepareTournamentSave} from './tournament-sync';
export class PlatformError extends Error{constructor(message:string,public status:number){super(message);this.name='PlatformError';}}
export async function platform(action:string,params:Record<string,unknown>={}){
 const {data:{session}}=await browserDb().auth.getSession();
 if(!session)throw Error('Ingresá con tu cuenta para continuar.');
 const response=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...params}),cache:'no-store'});
 const data=await response.json();const current=await browserDb().auth.getSession();if(current.data.session?.user.id!==session.user.id)throw Error('La cuenta cambió durante la operación. Volvé a abrir el torneo.');if(!response.ok){if(response.status===401)await browserDb().auth.signOut({scope:'local'});throw new PlatformError(data.error||'No pudimos completar la operación.',response.status);}return data;
}
export async function saveAccountTournament(t:Tournament){const saved=await platform('save',{tournament:prepareTournamentSave(t)});announceTournamentSaved(saved);return saved as Tournament;}
