import {prepareTournamentSave} from '../../../lib/tournament-sync';
import {formatValidationError} from '../../../lib/form-errors';
import {validatePlayoffs} from '../../../lib/playoffs';
import {NextRequest,NextResponse} from 'next/server';
import {supabase} from '../../../lib/supabase';
import {tournamentSchema} from '../../../lib/validation';
import {pairings,validateFixture} from '../../../lib/engine';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
 const key=req.headers.get('x-tournament-key')||'';
 if(!/^[a-f0-9]{64}$/.test(key))return NextResponse.json({error:'Abrí tu enlace privado de acceso.'},{status:403});
 const body=await req.json(),db=supabase(undefined,key);
 if(body.action==='save'){
 const t=prepareTournamentSave(tournamentSchema.parse(body.tournament));
 // Reject stale browser snapshots before entering the transactional write.
 // The RPC still enforces expected_version atomically for simultaneous saves.
 if(t.version>0){const current=await db.rpc('get_link_tournament',{tid:t.id});if(current.error)throw current.error;if(current.data?.version!==t.version)return NextResponse.json({error:'Otro colaborador modificó el torneo. Recargá antes de guardar.'},{status:409,headers:{'Cache-Control':'no-store'}});}
 if(t.matches.length){const issues=validateFixture(t.matches,t.settings);if(issues.length)throw Error(issues.join(' '));validatePlayoffs(t);const league=t.matches.filter(m=>m.kind!=='playoff');const expected=pairings(t.entrants,t.settings);const k=(m:{round:number;home:string;away:string;kind:string})=>`${m.round}:${m.home}:${m.away}:${m.kind}`;if(expected.length!==league.length||expected.some(m=>!league.some(x=>k(x)===k(m))))throw Error('Los enfrentamientos no coinciden con el formato.');}
 if(t.status!=='draft'&&!t.matches.length)throw Error('Generá el fixture antes de publicar.');
 const result=await db.rpc('save_link_tournament',{payload:t,expected_version:t.version});if(result.error)throw result.error;
 const saved=await db.rpc('get_link_tournament',{tid:t.id});if(saved.error)throw saved.error;
 return NextResponse.json(saved.data,{headers:{'Cache-Control':'no-store'}});
 }
 if(!/^[0-9a-f-]{36}$/i.test(body.id||''))throw Error('Torneo inválido.');
 const result=body.action==='read'?await db.rpc('get_link_tournament',{tid:body.id}):['list','create','revoke'].includes(body.action)?await db.rpc('manage_tournament_links',{tid:body.id,operation:body.action,link_id:body.linkId||null,label:body.label||null,new_secret:body.newSecret||null}):null;
 if(!result)throw Error('Operación inválida.');if(result.error)throw result.error;
 return NextResponse.json(result.data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){const err=e as {message?:string;code?:string};return NextResponse.json({error:err.code==='40001'?'Otro colaborador modificó el torneo. Recargá antes de guardar.':formatValidationError(e)||err.message||'No pudimos completar la operación.'},{status:err.code==='42501'?403:err.code==='40001'?409:400,headers:{'Cache-Control':'no-store'}});}
}
