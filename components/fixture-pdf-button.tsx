'use client';
import {useState} from 'react';
import {Download,Loader2} from 'lucide-react';
import type {Tournament} from '../lib/types';
export default function FixturePdfButton({t}:{t:Tournament}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){setBusy(true);setError('');try{
  const {createFixturePdf}=await import('../lib/fixture-pdf');const bytes=await createFixturePdf(t);
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),link=document.createElement('a');
  link.href=url;link.download=`fixture-${(t.slug||t.name).replace(/[^a-z0-9-]/gi,'-').slice(0,80)||'torneo'}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){setError(e instanceof Error?e.message:'No pudimos generar el PDF.');}finally{setBusy(false);}}
 return <div className="print-button"><button type="button" className="button secondary" disabled={busy||!t.matches.length} onClick={download} title="Descargar todo el fixture en una sola hoja">{busy?<Loader2 className="spin" size={16}/>:<Download size={16}/>} {busy?'Generando PDF…':'Descargar PDF'}</button>{error&&<p role="alert" className="error">{error}</p>}</div>;
}
