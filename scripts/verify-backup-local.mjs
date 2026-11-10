import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
async function main(){
const snapshot=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(snapshot.format,'gestor-torneos-application-snapshot-v1');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;`);
for(const name of readdirSync('supabase/migrations').filter(n=>!n.includes('platform_accounts')).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8').replace(/create extension[^;]*;/gi,''));
await db.exec('alter table private.tournament_collaborators add column if not exists enabled boolean not null default true');
await db.exec(readFileSync('supabase/baselines/20261108_live_functions.sql','utf8'));
await db.exec('set session_replication_role=replica');
const tables=Object.keys(snapshot.tables);for(const table of tables)assert.match(table,/^(public|private)\.[a-z_]+$/);
await db.exec('truncate '+tables.join(',')+' cascade');
for(const user of snapshot.authReferences||[])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[user.id,user.email,user.emailConfirmedAt]);
// Restore only into the disposable in-memory database above. No network clients.
for(const [table,rows] of Object.entries(snapshot.tables)){
 assert.match(table,/^(public|private)\.[a-z_]+$/);
 await db.query(`insert into ${table} overriding system value select * from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(rows)]);
 assert.equal(Number((await db.query(`select count(*) n from ${table}`)).rows[0].n),rows.length,table);
}
await db.exec('set session_replication_role=origin');
const before=(await db.query('select id,document from public.tournaments order by id')).rows;
await db.exec(readFileSync('supabase/migrations/20261108224333_platform_accounts_and_invitations.sql','utf8'));
assert.deepEqual((await db.query('select id,document from public.tournaments order by id')).rows,before);
assert.equal(Number((await db.query('select count(*) n from public.teams')).rows[0].n),snapshot.tables['public.teams'].length);
assert.equal(Number((await db.query('select count(*) n from public.matches')).rows[0].n),snapshot.tables['public.matches'].length);
console.log('PASS restored application snapshot into isolated in-memory PostgreSQL; migration preserved every tournament document and team/match counts. Auth credentials and Storage are outside this backup.');
await db.close();

}
main().catch(error=>{console.error('Backup verification failed:',error instanceof Error?error.message:'unknown error');process.exitCode=1;});
