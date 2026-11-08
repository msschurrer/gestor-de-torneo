'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {accessKey} from '../lib/link-access';
export default function AdminReturnLink({id}:{id:string}){const [allowed,setAllowed]=useState(false);useEffect(()=>{setAllowed(!!accessKey(id));},[id]);return allowed?<div className="container admin-return-strip"><Link href={`/admin/torneos/${id}`}><ArrowLeft size={14}/>Volver a administrar este torneo</Link><span>Acceso guardado en este navegador</span></div>:null;}
