import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;`);
for(const name of readdirSync('supabase/migrations').filter(n=>!n.includes('platform_accounts')).sort()){
 let sql=readFileSync('supabase/migrations/'+name,'utf8');
 sql=sql.replace(/create extension[^;]*;/gi,'');
 try{await db.exec(sql);}catch(e){console.error('Migration failed:',name,e.message);process.exit(1);}
}
await db.exec('alter table private.tournament_collaborators add column if not exists enabled boolean not null default true;');
await db.exec(readFileSync('supabase/baselines/20261108_live_functions.sql','utf8'));
const legacyId='20000000-0000-4000-a000-000000000099',legacySecret='d'.repeat(64);
const legacy={id:legacyId,slug:'legacy-keep',name:'Legacy preserved',season:'2026',category:'Primera',description:'Existing snapshot',rules:'',status:'draft',version:0,visibility:'private',settings:{groups:1,pitches:['Cancha 1']},entrants:[],matches:[]};
await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-tournament-key':legacySecret})]);await db.exec('set role anon');await db.query('select public.save_link_tournament($1::jsonb,0)',[JSON.stringify(legacy)]);await db.exec('reset role');
const legacyBefore=(await db.query('select document from public.tournaments where id=$1',[legacyId])).rows[0].document;
await db.exec(readFileSync('supabase/migrations/20261108224333_platform_accounts_and_invitations.sql','utf8'));
assert.deepEqual((await db.query('select document from public.tournaments where id=$1',[legacyId])).rows[0].document,legacyBefore);

console.log('Schema and account migration loaded on isolated PostgreSQL.');
const a='10000000-0000-4000-a000-000000000001',b='10000000-0000-4000-a000-000000000002',s='10000000-0000-4000-a000-000000000003';
for(const [id,email] of [[a,'owner@example.test'],[b,'guest@example.test'],[s,'super@example.test']])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);
await db.query('insert into private.platform_roles values($1,\'superadmin\')',[s]);
async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon');}
async function rpc(op,args={}){return (await db.query('select public.platform_action($1,$2::jsonb) result',[op,JSON.stringify(args)])).rows[0].result;}
async function denied(op,args){await assert.rejects(rpc(op,args));}
const id='20000000-0000-4000-a000-000000000001';
const payload={id,slug:'platform-test',name:'Platform Test',season:'2026',category:'Primera',description:'',rules:'',status:'draft',version:0,visibility:'public',settings:{groups:1,pitches:['Cancha 1']},entrants:[],matches:[],sanctions:[]};
await as(null);assert.equal((await db.query('select public.platform_status() result')).rows[0].result.schemaVersion,2);await denied('save',{tournament:payload});console.log('PASS anonymous write denied');
await as(a);let t=await rpc('save',{tournament:payload});assert.equal(t.access,'owner');assert.equal(t.version,1);let second=await rpc('save',{tournament:{...payload,id:'20000000-0000-4000-a000-000000000002',slug:'platform-second'}});assert.equal((await rpc('mine')).length,2);console.log('PASS multiple independent tournaments');
await db.exec("reset role");await db.query("update auth.users set raw_user_meta_data='{\"role\":\"superadmin\"}' where id=$1",[b]);await as(b);assert.equal((await rpc('me')).superadmin,false);await denied('read',{id});await denied('save',{tournament:t});await denied('super_users');console.log('PASS cross-user reads/writes and role escalation denied');
await as(a);const secret='a'.repeat(64);const invitation=await rpc('invite',{id,label:'Invitado',days:3,secret});await as(b);t=await rpc('accept',{secret});assert.equal(t.access,'editor');await denied('accept',{secret});await denied('invite',{id,label:'Abuso',days:3,secret:'b'.repeat(64)});await denied('read',{id:second.id});await denied('save',{tournament:{...t,visibility:'private'}});console.log('PASS one-use scoped invitation; collaborator cannot delegate or publish');
t=await rpc('save',{tournament:{...t,name:'Guest update'}});assert.equal(t.version,2);await as(a);assert.equal((await rpc('read',{id})).name,'Guest update');await rpc('revoke',{id,userId:b});await as(b);await denied('save',{tournament:t});console.log('PASS revocation blocks an existing session immediately');
await as(a);const exp='c'.repeat(64);await rpc('invite',{id,label:'Caduca',days:1,secret:exp});await as(s);await db.exec('reset role');await db.exec("update private.tournament_invitations set expires_at=now()-interval '1 second' where label='Caduca'");await as(b);await denied('accept',{secret:exp});console.log('PASS expiry enforced server-side');
await as(s);assert.equal((await rpc('super_users')).length,3);await rpc('super_suspend',{userId:a,suspended:true});await as(a);await denied('read',{id});await as(s);await rpc('super_suspend',{userId:a,suspended:false});assert((await rpc('super_audit')).length>0);console.log('PASS global supervision, suspension and audit');
await as(a);await assert.rejects(db.query('update public.tournaments set owner_id=$1 where id=$2',[b,id]));await assert.rejects(db.query("insert into private.platform_roles values($1,'superadmin')",[a]));await denied('save',{tournament:{...t,version:1}});console.log('PASS REST bypass, self-promotion and stale write denied');
await db.exec('reset role');await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-tournament-key':'0'.repeat(64)})]);await as(a);await denied('claim',{id:legacyId});
await db.exec('reset role');await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-tournament-key':legacySecret})]);await as(a);assert.equal((await rpc('claim',{id:legacyId})).access,'owner');
await db.exec('reset role');assert.deepEqual((await db.query('select document from public.tournaments where id=$1',[legacyId])).rows[0].document,legacyBefore);assert.equal((await db.query('select count(*)::int n from private.tournament_links where tournament_id=$1 and enabled',[legacyId])).rows[0].n,0);console.log('PASS legacy claim requires the original owner secret, preserves data and retires old links');
await as(a);await assert.rejects(db.query('select document from public.tournaments'));await assert.rejects(db.query('select public.list_tournaments()'));await assert.rejects(db.query('select * from public.match_events'));console.log('PASS hidden discipline cannot leak through obsolete snapshots or raw REST tables');

await db.exec('reset role');await db.query('insert into private.tournament_collaborators(tournament_id,email,user_id,enabled) values($1,$2,null,false)',[second.id,'guest@example.test']);
await as(a);await rpc('invite',{id:second.id,label:'Pending email migration',days:1,secret:'e'.repeat(64)});await as(b);assert.equal((await rpc('accept',{secret:'e'.repeat(64)})).access,'editor');
await db.exec('reset role');await db.query('update private.tournament_collaborators set email=$1,enabled=false where tournament_id=$2 and user_id=$3',['account:'+b,second.id,b]);
await as(a);await rpc('invite',{id:second.id,label:'Legacy account migration',days:1,secret:'f'.repeat(64)});await as(b);assert.equal((await rpc('accept',{secret:'f'.repeat(64)})).access,'editor');await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from private.tournament_collaborators where tournament_id=$1 and user_id=$2',[second.id,b])).rows[0].n,1);console.log('PASS old email and account memberships can accept invitations without duplicates');
await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.tournaments')).rows[0].n,3);console.log('PASS migration retained all test tournaments');await db.close();
