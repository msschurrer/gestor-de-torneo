'use client';
import Link from 'next/link';
import {useIdentity} from './session-provider';
export default function AdminReturnLink({id}:{id:string}){const{session,permissions}=useIdentity();return session&&permissions[id]?<div className="container admin-return-strip"><Link href={'/admin/torneos/'+id}>Administrar torneo</Link><span>Tu cuenta tiene permiso para este torneo</span></div>:null;}
