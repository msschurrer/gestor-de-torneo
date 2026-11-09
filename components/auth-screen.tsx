'use client';
import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {browserDb} from '../lib/supabase';
import {useIdentity} from './session-provider';
export default function AuthScreen({next='/admin'}:{next?:string}){
 const router=useRouter(),query=useSearchParams(),{session,loading}=useIdentity();
 const[register,setRegister]=useState(false),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const recovery=query.get('recuperar')==='1';const destination=query.get('crear')?'/admin/torneos/nuevo':next;
 useEffect(()=>{if(session&&!recovery)router.replace(destination);},[session,recovery,destination,router]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');setError('');try{
  const db=browserDb();
  if(recovery){const {error}=await db.auth.updateUser({password});if(error)throw error;router.replace('/admin');return;}
  if(register){const{data,error}=await db.auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim()},emailRedirectTo:location.origin+destination}});if(error)throw error;if(!data.session)setMessage('Revisá tu correo para confirmar la cuenta. Después ingresá con tu contraseña.');}
  else{const{error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
 }catch(e){setError(e instanceof Error?e.message:'No pudimos ingresar.');}finally{setBusy(false);}}
 return <div className="container page"><section className="panel auth-card"><span className="overline">GESTOR DE TORNEOS</span><h1>{recovery?'Recuperar contraseña':register?'Crear tu cuenta':'Ingresar'}</h1><p className="muted">{recovery?'Definí una contraseña personal nueva.':'Consultar torneos es libre. Tu cuenta permite crear y administrar los tuyos o colaborar por invitación.'}</p><form onSubmit={submit}>{register&&<label>Nombre y apellido<input required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}{!recovery&&<label>Correo electrónico · tu usuario<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}<label>Contraseña<input type="password" required minLength={8} maxLength={128} autoComplete={register||recovery?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy||loading}>{busy?'Procesando…':recovery?'Guardar contraseña':register?'Crear cuenta':'Ingresar'}</button></form>{error&&<p className="alert error" role="alert">{error}</p>}{message&&<p className="alert success" role="status">{message}</p>}{!recovery&&<><button className="text-link" onClick={()=>{setRegister(!register);setError('');setMessage('');}}>{register?'Ya tengo cuenta · Ingresar':'No tengo cuenta · Registrarme'}</button><button className="text-link" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{if(!email.trim())throw Error('Completá tu correo primero.');const{error}=await browserDb().auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/ingresar?recuperar=1'});if(error)throw error;setMessage('Si existe una cuenta, recibirás instrucciones para recuperarla.');}catch(e){setError(e instanceof Error?e.message:'No se pudo enviar.');}finally{setBusy(false);}}}>Olvidé mi contraseña</button></>}<Link className="text-link" href="/torneos">Volver a ver torneos</Link></section></div>;
}
