import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/platform/route';
for(const [name,authorization] of [['ausente',''],['esquema incorrecto','Basic public'],['token vacío','Bearer '],['token malformado','Bearer public-link']]){
 test(`API administrativa rechaza autorización ${name} antes de acceder a Supabase`,async()=>{
  const headers:Record<string,string>={'content-type':'application/json'};if(authorization)headers.authorization=authorization;
  const response=await POST(new NextRequest('http://localhost/api/platform',{method:'POST',headers,body:JSON.stringify({action:'save',tournament:{id:'00000000-0000-4000-a000-000000000000'}})}));
  assert.equal(response.status,401);assert.equal((await response.json()).error,'Ingresá para continuar.');
 });
}
