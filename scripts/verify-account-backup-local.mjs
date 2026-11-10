import {PGlite} from '@electric-sql/pglite';
import {readFileSync,chmodSync} from 'node:fs';
import assert from 'node:assert/strict';
async function main(){
 const path=process.argv[2];const s=JSON.parse(readFileSync(path,'utf8'));chmodSync(path,0o600);
 assert.equal(s.format,'gestor-torneos-account-recovery-v1');
 const db=new PGlite();await db.exec('create schema auth');
 for(const table of ['users','identities']){
  const cols=s.columns.filter(c=>c.table===table);assert(cols.length);
  for(const c of cols){assert.match(c.column,/^[a-z_]+$/);assert.match(c.type,/^[a-z0-9_ (),]+$/i);}
  await db.exec(`create table auth.${table} (${cols.map(c=>`"${c.column}" ${c.type}`).join(',')},primary key(id))`);
  await db.query(`insert into auth.${table} select * from jsonb_populate_recordset(null::auth.${table},$1::jsonb)`,[JSON.stringify(s[table])]);
  assert.equal(Number((await db.query(`select count(*) n from auth.${table}`)).rows[0].n),s[table].length);
 }
 await db.exec('alter table auth.identities add foreign key(user_id) references auth.users(id)');
 const restored=(await db.query('select id,email,encrypted_password from auth.users order by id')).rows;
 const expected=s.users.map(({id,email,encrypted_password})=>({id,email,encrypted_password})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(restored,expected);await db.close();
 console.log('PASS isolated account recovery copy: user IDs, emails, password hashes and identity references preserved. No network connection. Sessions and configuration excluded.');
}
main().catch(()=>{console.error('Account backup verification failed; no private records printed.');process.exitCode=1;});
