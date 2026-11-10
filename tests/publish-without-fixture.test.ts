import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/platform/route';
import {demoTournament} from '../lib/demo';
import {tournamentSchema} from '../lib/validation';
for(const status of ['published','draft'] as const)test(`API conserva publicación explícita ${status} sin exigir fixture`,async context=>{
 const previousFetch=globalThis.fetch,oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 context.after(()=>{globalThis.fetch=previousFetch;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://isolated.example.test';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
 let saved:Record<string,unknown>|undefined;
 globalThis.fetch=async(input,init)=>{const url=String(input);if(url.endsWith('/auth/v1/user'))return Response.json({id:'10000000-0000-4000-a000-000000000001',aud:'authenticated',email:'owner@example.test',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});if(url.endsWith('/rest/v1/rpc/platform_action')){const body=JSON.parse(String(init?.body));assert.equal(body.operation,'save');saved=body.args.tournament;return Response.json(saved);}throw Error('Unexpected external request blocked');};
 const tournament={...demoTournament(),matches:[],status};
 const response=await POST(new NextRequest('http://localhost/api/platform',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test.owner.signature'},body:JSON.stringify({action:'save',tournament})}));
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(saved?.status,status);assert.deepEqual(saved?.matches,[]);assert.equal((await response.json()).entrants.length,tournament.entrants.length);
});
test('permitir un torneo anunciado no permite publicar fechas ya generadas sin calendario',()=>{const tournament=demoTournament();tournament.status='published';tournament.settings.autoSchedule=true;tournament.settings.roundCalendar=[];assert.equal(tournamentSchema.safeParse(tournament).success,false);});
