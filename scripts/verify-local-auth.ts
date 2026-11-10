import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {defaultSettings,uid,type Tournament} from '../lib/types';
const values=Object.fromEntries(readFileSync('.env.development.local','utf8').split('\n').filter(Boolean).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
const url=values.NEXT_PUBLIC_SUPABASE_URL,key=values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const host=(value:string)=>['127.0.0.1','localhost','[::1]'].includes(new URL(value).hostname);
assert(host(url),'Solo se permite Supabase local. Nunca ejecutar esta suite contra producción.');
const mail=process.env.LOCAL_MAIL_URL||'http://127.0.0.1:54324';assert(host(mail));
const newClient=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function signup(label:string){const client=newClient(),email=`${label}-${Date.now()}-${randomBytes(4).toString('hex')}@example.test`,password=randomBytes(24).toString('base64url');
 const result=await client.auth.signUp({email,password});assert.ifError(result.error);assert(result.data.user);assert.equal(result.data.session,null,'La confirmación de correo debe estar activada en local.');
 let token='';
 for(let attempt=0;attempt<30&&!token;attempt++){
  const list=await fetch(mail+'/api/v1/messages').then(r=>r.json());
  const row=list.messages?.find((m:{ID:string;To:{Address:string}[]})=>m.To?.some(t=>t.Address===email));
  if(row){const body=await fetch(mail+'/api/v1/message/'+encodeURIComponent(row.ID)).then(r=>r.json());const text=String(body.HTML||body.Text||'').replaceAll('&amp;','&');for(const candidate of text.match(/https?:\/\/[^\s"<>]+/g)||[]){const link=new URL(candidate);if(host(link.origin)&&link.pathname.endsWith('/verify')&&link.searchParams.get('type')==='signup'){token=link.searchParams.get('token')||'';break;}}}
  if(!token)await new Promise(r=>setTimeout(r,200));
 }
 assert(token,'No se encontró el correo de confirmación en Mailpit local.');
 const verified=await client.auth.verifyOtp({token_hash:token,type:'signup'});assert.ifError(verified.error);assert(verified.data.session);
 await client.auth.signOut();const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);assert(login.data.session);
 return {client,email,password};
}
async function rpc(client:ReturnType<typeof newClient>,operation:string,args:Record<string,unknown>={}){const{data,error}=await client.rpc('platform_action',{operation,args});assert.ifError(error);return data;}
const anonymous=createClient(url,key,{auth:{persistSession:false}});const readiness=await anonymous.rpc('platform_status');assert.ifError(readiness.error);assert.equal(readiness.data.schemaVersion,2);
const owner=await signup('creador'),guest=await signup('invitado');console.log('PASS registro, correo local, confirmación, salida e ingreso de dos cuentas');
const make=(name:string):Tournament=>({id:uid(),slug:name+'-'+Date.now(),name,season:'2026',category:'Prueba local',description:'Solo datos ficticios locales',rules:'',status:'draft',version:0,visibility:'private',demo:true,settings:{...defaultSettings,groups:1},entrants:[],matches:[]});
const t=await rpc(owner.client,'save',{tournament:make('Torneo local uno')});const other=await rpc(owner.client,'save',{tournament:make('Torneo local dos')});assert((await rpc(owner.client,'mine')).some((x:Tournament)=>x.id===other.id));
const announcement=await rpc(owner.client,'save',{tournament:{...make('Torneo anunciado'),status:'published',visibility:'public'}});const listing=await anonymous.rpc('list_public_tournaments');assert.ifError(listing.error);assert(listing.data.some((x:Tournament)=>x.id===announcement.id&&x.matches.length===0));console.log('PASS torneo público sin fixture visible para visitantes sin cuenta');
// Exercise real Storage API and its RLS against local services, never production.
const pdfPath=announcement.id+'/'+uid()+'.pdf',pdf2=announcement.id+'/'+uid()+'.pdf';
const pdfBlob=new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'});
assert.ifError((await owner.client.storage.from('tournament-rules').upload(pdfPath,pdfBlob)).error);
assert((await anonymous.storage.from('tournament-rules').download(pdfPath)).error,'Unattached PDF must stay private');
let withPdf=await rpc(owner.client,'save',{tournament:{...announcement,settings:{...announcement.settings,rulesPdf:{path:pdfPath,name:'Reglamento.pdf',size:pdfBlob.size}}}});
assert.ifError((await anonymous.storage.from('tournament-rules').download(pdfPath)).error);
assert((await guest.client.storage.from('tournament-rules').upload(pdf2,pdfBlob)).error,'Other accounts cannot upload');
withPdf=await rpc(owner.client,'save',{tournament:{...withPdf,visibility:'private'}});
assert((await anonymous.storage.from('tournament-rules').download(pdfPath)).error);
assert.ifError((await owner.client.storage.from('tournament-rules').download(pdfPath)).error);
const pdfSecret=randomBytes(32).toString('hex');await rpc(owner.client,'invite',{id:announcement.id,label:'PDF invitado',secret:pdfSecret,days:1});await rpc(guest.client,'accept',{secret:pdfSecret});
assert.ifError((await guest.client.storage.from('tournament-rules').download(pdfPath)).error);
await rpc(owner.client,'revoke',{id:announcement.id,userId:(await rpc(guest.client,'me')).id});
assert((await guest.client.storage.from('tournament-rules').download(pdfPath)).error,'Revoked editor cannot read private PDF');
assert.ifError((await owner.client.storage.from('tournament-rules').upload(pdf2,pdfBlob)).error);
withPdf=await rpc(owner.client,'save',{tournament:{...withPdf,visibility:'public',settings:{...withPdf.settings,rulesPdf:{path:pdf2,name:'Nuevo reglamento.pdf',size:pdfBlob.size}}}});
assert((await anonymous.storage.from('tournament-rules').download(pdfPath)).error,'Replaced PDF must no longer be public');
assert.ifError((await anonymous.storage.from('tournament-rules').download(pdf2)).error);
console.log('PASS real PDF upload, anonymous read, private access, replacement and outsider upload rejection');
assert((await guest.client.rpc('platform_action',{operation:'read',args:{id:t.id}})).error);assert((await anonymous.rpc('platform_action',{operation:'read',args:{id:t.id}})).error);
const secret=randomBytes(32).toString('hex');await rpc(owner.client,'invite',{id:t.id,label:'Invitado local',secret,days:1});let invited=await rpc(guest.client,'accept',{secret});assert.equal(invited.access,'editor');assert((await guest.client.rpc('platform_action',{operation:'accept',args:{secret}})).error);
invited=await rpc(guest.client,'save',{tournament:{...invited,name:'Actualizado por invitado'}});assert.equal((await rpc(owner.client,'read',{id:t.id})).name,invited.name);assert((await guest.client.rpc('platform_action',{operation:'read',args:{id:other.id}})).error);
const me=await rpc(guest.client,'me');await rpc(owner.client,'revoke',{id:t.id,userId:me.id});assert((await guest.client.rpc('platform_action',{operation:'save',args:{tournament:invited}})).error);console.log('PASS invitación de un uso, aislamiento por torneo, persistencia y revocación con sesión abierta');
await owner.client.auth.signOut({scope:'global'});const relogin=await owner.client.auth.signInWithPassword({email:owner.email,password:owner.password});assert.ifError(relogin.error);assert.equal((await rpc(owner.client,'read',{id:t.id})).name,invited.name);await rpc(owner.client,'delete',{id:t.id});await rpc(owner.client,'delete',{id:other.id});await rpc(owner.client,'delete',{id:announcement.id});await owner.client.auth.signOut({scope:'global'});await guest.client.auth.signOut({scope:'global'});console.log('PASS datos conservados después de cerrar sesión. Torneos ficticios retirados, solo en local.');
