'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {Tournament} from '../lib/types';
import {TournamentEditor} from './app';
import {accessKey,manage,rememberAccess,savedAccesses,saveWithAccess,type SavedAccess} from '../lib/link-access';
export default function LinkAdmin({path}:{path:string[]}){
 const[rows,setRows]=useState<SavedAccess[]>([]),[selected,setSelected]=useState<Tournament|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const id=path[1]==='torneos'?path[2]:undefined;
 useEffect(()=>{let alive=true;setSelected(null);setError('');setLoading(true);async function load(){try{
 if(id&&id!=='nuevo'){const fragment=new URLSearchParams(location.hash.slice(1));const key=fragment.get('access');if(key&&/^[a-f0-9]{64}$/.test(key)){rememberAccess({id,key,name:'Torneo compartido'});history.replaceState(null,'',location.pathname+location.search);}
 const keySaved=accessKey(id);if(!keySaved)throw Error('Abrí el enlace privado que te compartió el creador del torneo.');const t=await manage(keySaved,{action:'read',id});rememberAccess({id,key:keySaved,name:t.name,role:t.access});if(alive)setSelected(t);}
 if(alive)setRows(savedAccesses());
 }catch(e){if(alive)setError(e instanceof Error?e.message:'No pudimos abrir el torneo.');}finally{if(alive)setLoading(false);}}void load();return()=>{alive=false;};},[id]);
 async function save(t:Tournament){const data=await saveWithAccess(t);setRows(savedAccesses());return data;}
 return <div className="container page"><div className="section-heading"><Link href="/torneos" className="breadcrumb dark">← Ver torneos</Link><Link href="/admin/torneos/nuevo" className="button">Crear torneo</Link></div>{loading?<p>Cargando…</p>:error?<div className="panel form-panel"><h1>Acceso privado</h1><p role="alert">{error}</p><Link href="/admin">Volver a mis torneos</Link></div>:id==='nuevo'?<TournamentEditor key="new" save={save}/>:selected?<TournamentEditor key={selected.id} initial={selected} save={save}/>:<><h1>Mis torneos</h1><p className="muted">Accesos guardados en este navegador. Conservá tu enlace privado para usar otro dispositivo o recuperar el acceso.</p><div className="admin-tournaments">{rows.map(r=><Link className="panel admin-tournament" href={`/admin/torneos/${r.id}`} key={r.id}><div><h3>{r.name}</h3><p>{r.role==='owner'?'Creador':'Colaborador'}</p></div>→</Link>)}</div>{!rows.length&&<div className="panel form-panel"><h2>Creá tu primer torneo</h2><p>No necesitás registrarte. Al guardarlo, recibís tu enlace privado de administración.</p><Link className="button" href="/admin/torneos/nuevo">Crear torneo</Link></div>}</>}</div>;
}
