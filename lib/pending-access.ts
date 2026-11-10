const prefix='gestor-pending-owner-v2:';
const validId=(id:string)=>/^[a-f0-9-]{36}$/i.test(id);
export function capturePendingOwner(id:string,hash:string):boolean{
 if(!validId(id))return false;
 const key=new URLSearchParams(hash.replace(/^#/,'' )).get('access');
 if(!key||!/^[a-f0-9]{64}$/.test(key))return false;
 try{sessionStorage.setItem(prefix+id,key);return true;}catch{return false;}
}
export function pendingOwner(id:string){try{if(!validId(id))return '';const key=sessionStorage.getItem(prefix+id)||'';return /^[a-f0-9]{64}$/.test(key)?key:'';}catch{return '';}}
export function forgetPendingOwner(id:string){try{sessionStorage.removeItem(prefix+id);}catch{}}
