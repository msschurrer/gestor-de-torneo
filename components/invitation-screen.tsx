'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import AuthScreen from './auth-screen';
import {useIdentity} from './session-provider';
import {platform} from '../lib/platform-client';
export default function InvitationScreen(){const{session,loading,refresh}=useIdentity(),router=useRouter();const[secret,setSecret]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const fragment=new URLSearchParams(location.hash.slice(1));const token=fragment.get('invitacion');try{if(token&&/^[a-f0-9]{64}$/.test(token)){sessionStorage.setItem('gestor-pending-invitation-v2',token);history.replaceState(null,'',location.pathname);}setSecret(sessionStorage.getItem('gestor-pending-invitation-v2')||'');}catch{setSecret(token||'');}},[]);
 if(loading)return <p className="container page">Comprobando sesión…</p>;
 if(!session)return <AuthScreen next="/invitacion"/>;
 return <div className="container page"><section className="panel form-panel"><h1>Activar invitación</h1><p>Vas a usar tu cuenta personal {session.user.email} para administrar únicamente el torneo de esta invitación. El creador puede revocar el permiso.</p><button className="button" disabled={!secret||busy} onClick={async()=>{setBusy(true);setError('');try{const t=await platform('accept',{secret});sessionStorage.removeItem('gestor-pending-invitation-v2');await refresh();router.replace('/admin/torneos/'+t.id);}catch(e){setError(e instanceof Error?e.message:'Invitación inválida.');}finally{setBusy(false);}}}>{busy?'Activando…':'Aceptar y administrar'}</button>{!secret&&<p role="alert">Abrí el enlace de invitación completo que te compartió el creador.</p>}{error&&<p role="alert" className="alert error">{error}</p>}</section></div>;
}
