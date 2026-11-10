import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabase} from '../../../lib/supabase';
import {RULES_BUCKET,RULES_MAX_BYTES,rulesPathPattern,validateRulesPdf} from '../../../lib/rules-pdf';
export const dynamic='force-dynamic';
function token(req:NextRequest){return /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'')?.[1];}
export async function POST(req:NextRequest){
 try{
  const jwt=token(req);if(!jwt)return NextResponse.json({error:'Ingresá para cargar el reglamento.'},{status:401});
  if(Number(req.headers.get('content-length'))>RULES_MAX_BYTES+65536)return NextResponse.json({error:'El PDF debe pesar hasta 4 MB.'},{status:413});
  const db=supabase(jwt);const auth=await db.auth.getUser(jwt);if(auth.error||!auth.data.user)return NextResponse.json({error:'Tu sesión venció.'},{status:401});
  const form=await req.formData(),id=z.uuid().parse(form.get('tournamentId')),file=form.get('file');
  if(!(file instanceof File))throw Error('Seleccioná un archivo PDF.');
  const name=await validateRulesPdf(file),path=`${id}/${crypto.randomUUID()}.pdf`;
  const {error}=await db.storage.from(RULES_BUCKET).upload(path,file,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
  if(error)return NextResponse.json({error:'No pudimos cargar el PDF. Verificá que el torneo esté guardado y tengas permiso para editarlo.'},{status:403});
  return NextResponse.json({path,name,size:file.size},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No pudimos cargar el PDF.'},{status:400});}
}
export async function GET(req:NextRequest){
 const path=req.nextUrl.searchParams.get('path')||'';
 if(!rulesPathPattern.test(path))return NextResponse.json({error:'Archivo inválido.'},{status:400});
 const {data,error}=await supabase(token(req)).storage.from(RULES_BUCKET).download(path);
 if(error||!data)return NextResponse.json({error:'El reglamento no está disponible o no tenés permiso para verlo.'},{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(data,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="reglamento.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
