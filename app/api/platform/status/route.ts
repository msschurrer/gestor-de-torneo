import {NextResponse} from 'next/server';
import {supabase} from '../../../../lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){try{const{data,error}=await supabase().rpc('platform_status');return NextResponse.json({ready:!error&&data?.schemaVersion===2},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({ready:false},{headers:{'Cache-Control':'no-store'}});}}
