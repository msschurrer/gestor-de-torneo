import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabase} from '../../../lib/supabase';
import {tournamentSchema} from '../../../lib/validation';
import {prepareTournamentSave} from '../../../lib/tournament-sync';
import {validateFixture,pairings} from '../../../lib/engine';
import {validatePlayoffs} from '../../../lib/playoffs';
import {formatValidationError} from '../../../lib/form-errors';
export const dynamic='force-dynamic';
const command=z.object({action:z.enum(['me','mine','permissions','read','save','accesses','invite','accept','revoke','revoke_invitation','claim','audit','transfer','delete','super_users','super_tournaments','super_restore','super_suspend','super_settings','super_audit']),id:z.uuid().optional(),userId:z.uuid().optional(),invitationId:z.uuid().optional(),secret:z.string().regex(/^[a-f0-9]{64}$/).optional(),legacyKey:z.string().regex(/^[a-f0-9]{64}$/).optional(),label:z.string().trim().min(1).max(80).optional(),days:z.number().int().min(1).max(30).optional(),suspended:z.boolean().optional(),settings:z.object({registrationsOpen:z.boolean()}).strict().optional(),tournament:z.unknown().optional()}).strict();
export async function POST(req:NextRequest){try{
 if(process.env.PLATFORM_ACCOUNTS_READY!=='true')return NextResponse.json({error:'Esta actualización todavía está en validación. El acceso con cuentas se habilitará después de aprobar la migración.'},{status:503});
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return NextResponse.json({error:'Ingresá para continuar.'},{status:401});
 const db=supabase(token);const{data:{user},error}=await db.auth.getUser(token);if(error||!user)return NextResponse.json({error:'Tu sesión venció. Volvé a ingresar.'},{status:401});
 const body=command.parse(await req.json());const{action,legacyKey,...args}=body;
 if(action==='claim'&&!legacyKey)throw Error('Necesitás el enlace original de creador.');
 if(action==='save'){
  const t=prepareTournamentSave(tournamentSchema.parse(args.tournament));
  if(t.matches.length){const issues=validateFixture(t.matches,t.settings);if(issues.length)throw Error(issues.join(' '));validatePlayoffs(t);const expected=pairings(t.entrants,t.settings),actual=t.matches.filter(m=>m.kind!=='playoff');const key=(m:{round:number;home:string;away:string;kind:string})=>`${m.round}:${m.home}:${m.away}:${m.kind}`;if(actual.length!==expected.length||expected.some(m=>!actual.some(x=>key(x)===key(m))))throw Error('Los enfrentamientos no coinciden con el formato.');}
  if(t.status!=='draft'&&!t.matches.length)throw Error('Generá el fixture antes de publicar.');args.tournament=t;
 }
 const result=await (legacyKey?supabase(token,legacyKey):db).rpc('platform_action',{operation:action,args});if(result.error)throw result.error;
 return NextResponse.json(result.data,{headers:{'Cache-Control':'no-store'}});
 }catch(e){const err=e as {code?:string;message?:string};const status=err.code==='42501'?403:err.code==='PT409'||err.code==='40001'?409:400;return NextResponse.json({error:formatValidationError(e)||err.message||'No pudimos completar la operación.'},{status,headers:{'Cache-Control':'no-store'}});}}
