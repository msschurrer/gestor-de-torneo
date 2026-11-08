'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {accessKey} from '../lib/link-access';
export default function AdminReturnLink({id}:{id:string}){const [allowed,setAllowed]=useState(false);useEffect(()=>{try{setAllowed(!!accessKey(id)&&!!sessionStorage.getItem('gestor-admin-return-v1'));}catch{setAllowed(false);}},[id]);return allowed?<div className="container admin-return-strip"><Link href={`/admin/torneos/${id}`}><ArrowLeft size={14}/>Cambiar a administración</Link><span>Tenés un acceso privado guardado en este navegador</span></div>:null;}
