'use client';
import {createContext,useContext,useEffect,useState,useRef} from 'react';
import type {Session} from '@supabase/supabase-js';
import {browserDb} from '../lib/supabase';
import {platform} from '../lib/platform-client';
type Identity={session:Session|null;loading:boolean;ready:boolean;permissions:Record<string,string>;superadmin:boolean;refresh:()=>Promise<void>};
const Context=createContext<Identity>({session:null,loading:true,ready:false,permissions:{},superadmin:false,refresh:async()=>{}});
export const useIdentity=()=>useContext(Context);
export default function SessionProvider({children}:{children:React.ReactNode}){
 const[ready,setReady]=useState(false);
 useEffect(()=>{fetch("/api/platform/status",{cache:"no-store"}).then(r=>r.json()).then(d=>setReady(d.ready===true)).catch(()=>setReady(false));},[]);
 const[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[permissions,setPermissions]=useState<Record<string,string>>({}),[superadmin,setSuper]=useState(false);
 const generation=useRef(0);
 async function refresh(){const run=generation.current;try{const[p,me]=await Promise.all([platform('permissions'),platform('me')]);if(run!==generation.current)return;setPermissions(p);setSuper(me.superadmin);}catch{if(run===generation.current){setPermissions({});setSuper(false);}}}
 useEffect(()=>{let alive=true;browserDb().auth.getSession().then(({data})=>{if(alive){setSession(data.session);setLoading(false);}});const{data}=browserDb().auth.onAuthStateChange((_event,next)=>{if(alive){setSession(next);setLoading(false);}});return()=>{alive=false;data.subscription.unsubscribe();};},[]);
 useEffect(()=>{generation.current++;if(!session){setPermissions({});setSuper(false);return;}void refresh();const timer=window.setInterval(()=>void refresh(),15000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',focus);};},[session?.user.id]);
 return <Context.Provider value={{session,loading,ready,permissions,superadmin,refresh}}>{children}</Context.Provider>;
}
