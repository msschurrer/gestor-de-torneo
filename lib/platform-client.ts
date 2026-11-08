import {browserDb} from './supabase';
import type {Tournament} from './types';
import {announceTournamentSaved,prepareTournamentSave} from './tournament-sync';
export async function platform(action:string,params:Record<string,unknown>={}){
 const {data:{session}}=await browserDb().auth.getSession();
 if(!session)throw Error('Ingresá con tu cuenta para continuar.');
 const response=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...params}),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'No pudimos completar la operación.');return data;
}
export async function saveAccountTournament(t:Tournament){const saved=await platform('save',{tournament:prepareTournamentSave(t)});announceTournamentSaved(saved);return saved as Tournament;}
