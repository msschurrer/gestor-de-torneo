'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {allDrafts,readDraft,startNewDraft,type EditorDraft} from '../lib/editor-drafts';
import type {Tournament} from '../lib/types';
import {TournamentEditor,AdminTournamentPreview} from './app';
import {accessKey} from '../lib/link-access';
import {platform,saveAccountTournament} from '../lib/platform-client';
import {useIdentity} from './session-provider';
import AuthScreen from './auth-screen';
import Account from './account';
import PlatformPanel from './platform-panel';
export default function LinkAdmin({path}:{path:string[]}){
 const identity=useIdentity();const[rows,setRows]=useState<Tournament[]>([]),[selected,setSelected]=useState<Tournament|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[drafts,setDrafts]=useState<EditorDraft[]>([]),[legacyKey,setLegacyKey]=useState('');
 const id=path[1]==='torneos'?path[2]:undefined,draftId=path[1]==='borradores'?path[2]:undefined;
 useEffect(()=>{if(!identity.session){setSelected(null);setRows([]);setLoading(false);return;}let alive=true;setSelected(null);setError('');setLoading(true);async function load(){try{
 if(id&&id!=='nuevo'){const fragment=new URLSearchParams(location.hash.slice(1)),key=fragment.get('access');if(key&&/^[a-f0-9]{64}$/.test(key)){setLegacyKey(key);history.replaceState(null,'',location.pathname+location.search);}else setLegacyKey(accessKey(id));const t=await platform('read',{id});if(alive)setSelected(t);}
 else if(!['cuenta','plataforma'].includes(path[1]||'')){const ts=await platform('mine');if(alive)setRows(ts);}
 if(draftId&&!readDraft(draftId))throw Error('No encontramos ese borrador en este navegador.');if(alive)setDrafts(allDrafts());
 }catch(e){if(alive)setError(e instanceof Error?e.message:'No pudimos abrir el torneo.');}finally{if(alive)setLoading(false);}}void load();return()=>{alive=false;};},[id,draftId,identity.session?.user.id,path[1]]);
 async function save(t:Tournament){const data=await saveAccountTournament(t);setSelected(data);await identity.refresh();return data;}
 if(identity.loading)return <p className="container page">Comprobando sesión…</p>;
 if(!identity.session)return <AuthScreen next={'/'+path.join('/')}/>;
 if(!identity.ready)return <div className="container page"><h1>Actualización en validación</h1><p>Tu cuenta puede registrarse e iniciar sesión. La administración de torneos necesita que se aplique la migración en este entorno; la consulta pública sigue disponible.</p><Link className="button secondary" href="/torneos">Ver torneos</Link></div>;
 return <div className="container page admin-page"><div className="admin-page-links"><Link href="/torneos" className="breadcrumb dark">← Ver torneos</Link>{id||draftId||path[1]?<Link href="/admin" className="text-link">Mis torneos</Link>:<a href="/admin/torneos/nuevo" className="button" onClick={startNewDraft}>Crear torneo</a>}</div>{path[1]==='cuenta'?<Account/>:path[1]==='plataforma'?<PlatformPanel/>:loading?<p>Cargando…</p>:error?<div className="panel form-panel"><h1>Acceso al torneo</h1><p role="alert">{error}</p>{id&&legacyKey&&<><p>Si creaste este torneo antes de las cuentas personales, podés vincularlo demostrando tu acceso original de creador. Los datos deportivos se conservan.</p><button className="button" onClick={async()=>{try{setError('');const t=await platform('claim',{id,legacyKey});setSelected(t);setLegacyKey('');await identity.refresh();}catch(e){setError(e instanceof Error?e.message:'No se pudo vincular.');}}}>Vincular torneo antiguo con mi cuenta</button></>}<Link className="text-link" href="/admin">Volver a mis torneos</Link></div>:draftId?<TournamentEditor key={'draft-'+draftId} draftId={draftId} save={save}/>:id==='nuevo'?<TournamentEditor key="new" save={save}/>:selected&&path[3]==='vista'?<AdminTournamentPreview t={selected} tab={path[4]||'resumen'}/>:selected?<TournamentEditor key={selected.id} initial={selected} save={save}/>:<><h1>Mis torneos</h1><p className="muted">Los torneos que creaste y aquellos que administrás por invitación. Tus permisos se conservan en tu cuenta, también desde otros dispositivos.</p><div className="admin-tournaments">{drafts.filter(d=>d.tournament.version===0).map(d=><Link className="panel admin-tournament" href={'/admin/borradores/'+d.tournament.id} key={'draft-'+d.tournament.id}><div><h3>{d.tournament.name||'Torneo sin nombre'}</h3><p>Borrador local · pendiente de guardar en tu cuenta</p></div>→</Link>)}{rows.map(t=><Link className="panel admin-tournament" href={'/admin/torneos/'+t.id} key={t.id}><div><h3>{t.name}</h3><p>{t.access==='owner'?'Creador':'Administrador invitado'} · {t.status==='draft'?'Borrador':t.status==='finished'?'Finalizado':'Publicado'}</p></div>→</Link>)}</div>{!rows.length&&!drafts.length&&<div className="panel form-panel"><h2>Creá tu primer torneo</h2><p>Tu cuenta será su creadora. Después podrás invitar a colaboradores con un enlace de activación.</p><Link className="button" href="/admin/torneos/nuevo">Crear torneo</Link></div>}</>}</div>;
}
