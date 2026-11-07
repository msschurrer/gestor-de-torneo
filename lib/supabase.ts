import { createClient } from '@supabase/supabase-js';
export function supabase(token?:string){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw Error('Falta configurar Supabase.');return createClient(url,key,{auth:{persistSession:typeof window!=='undefined',autoRefreshToken:typeof window!=='undefined',detectSessionInUrl:typeof window!=='undefined'},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});}
let browserClient:ReturnType<typeof supabase>|null=null;
export function browserDb(){return browserClient??=supabase();}
