'use client';
import {useEffect,useRef,useState} from 'react';
import type {RulesPdf,Tournament} from '../lib/types';
import {rulesPathPattern,validateRulesPdf} from '../lib/rules-pdf';
import {useIdentity} from './session-provider';
export function RulesPdfEditor({tournament:t,onChange}:{tournament:Tournament;onChange:(pdf:RulesPdf|undefined)=>void}){
 const {session}=useIdentity();const[busy,setBusy]=useState(false),[message,setMessage]=useState('');const input=useRef<HTMLInputElement>(null);
 return <div className="span-2"><label>Reglamento en PDF<input ref={input} type="file" accept="application/pdf,.pdf" disabled={busy||!t.version} onChange={async e=>{
 const file=e.target.files?.[0];if(!file)return;setBusy(true);setMessage('');try{
 await validateRulesPdf(file);const form=new FormData();form.set('tournamentId',t.id);form.set('file',file);
 const response=await fetch('/api/tournament-rules',{method:'POST',headers:{Authorization:`Bearer ${session?.access_token||''}`},body:form});const result=await response.json();if(!response.ok)throw Error(result.error||'No pudimos cargar el PDF.');
 if(!rulesPathPattern.test(result.path))throw Error('La respuesta del archivo no es válida.');onChange(result);setMessage('PDF cargado. Guardá el torneo para que los visitantes puedan verlo.');
 }catch(error){setMessage(error instanceof Error?error.message:'No pudimos cargar el PDF.');}finally{setBusy(false);if(input.current)input.current.value='';}
 }}/></label><small>{!t.version?'Guardá primero el torneo para adjuntar el archivo.':'Hasta 4 MB. Seleccioná otro PDF para reemplazar el actual.'}</small>{busy&&<p role="status">Cargando PDF…</p>}{t.settings.rulesPdf&&<p>{t.settings.rulesPdf.name} · <button type="button" className="text-link" disabled={busy} onClick={()=>{onChange(undefined);setMessage('Guardá el torneo para quitar el PDF.');}}>Quitar PDF</button></p>}{message&&<p role="status" className="info-line">{message}</p>}</div>;
}
export function RulesPdfViewer({pdf}:{pdf?:RulesPdf}){
 const {session}=useIdentity();const[url,setUrl]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);const path=pdf?.path,token=session?.access_token;
 useEffect(()=>{setUrl('');setError('');if(!path)return;let active=true,objectUrl='';const controller=new AbortController();setLoading(true);
 fetch(`/api/tournament-rules?path=${encodeURIComponent(path)}`,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('No se pudo abrir el reglamento. Volvé a intentar.');return response.blob();}).then(blob=>{if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active)setLoading(false);});
 return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[path,token]);
 if(!pdf)return null;
 return <section aria-label="Reglamento en PDF" style={{marginBottom:20}}><p><b>{pdf.name}</b></p>{loading&&<p role="status">Abriendo reglamento…</p>}{error&&<p role="alert">{error}</p>}{url&&<><div className="modal-actions"><a className="button" href={url} target="_blank" rel="noopener noreferrer">Abrir PDF</a><a className="button secondary" href={url} download={pdf.name}>Descargar</a></div><iframe title="Reglamento del torneo" src={url} style={{width:'100%',height:'65vh',border:'1px solid #dbe2d5',borderRadius:12,marginTop:16}}/></>}</section>;
}
