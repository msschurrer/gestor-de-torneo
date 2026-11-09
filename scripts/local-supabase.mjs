import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const mode=process.argv[2]||'start';
if(!['start','env','stop'].includes(mode))throw Error('Usá start, env o stop. No se admiten operaciones contra proyectos alojados.');
const cli=(args,options={})=>{const r=spawnSync('npx',['--yes','supabase@3.0.0',...args],{encoding:'utf8',...options});if(r.error||r.status!==0)throw Error('No se pudo ejecutar Supabase local. Verificá que Docker esté instalado y ejecutándose.');return r.stdout;};
if(mode==='start'){
 const docker=spawnSync('docker',['info'],{stdio:'ignore'});
 if(docker.error||docker.status!==0){console.error('Supabase local necesita Docker. No se creó ni modificó ningún proyecto en la nube. Podés ejecutar npm run test:platform sin Docker.');process.exit(1);}
 console.log('Iniciando servicios locales; la salida con claves de desarrollo no se imprime.');
 cli(['start','--exclude','studio,imgproxy,logflare,vector,supavisor,edge-runtime']);
}
if(mode==='stop'){cli(['stop'],{stdio:'inherit'});process.exit(0);}
const status=JSON.parse(cli(['status','--output','json']));
const url=status.API_URL||status.api_url,key=status.ANON_KEY||status.anon_key||status.PUBLISHABLE_KEY;
const local=(value)=>{try{return ['127.0.0.1','localhost','[::1]'].includes(new URL(value).hostname);}catch{return false;}};
if(!local(url)||typeof key!=='string'||!key)throw Error('Se rechazó una configuración no local o incompleta.');
// Never copy service-role, database passwords, or remote values into browser configuration.
writeFileSync('.env.development.local',`NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`,{mode:0o600});
console.log('Configuración de desarrollo local preparada. No se sobrescribió .env.local. Ejecutá npm run dev. Correo local: http://127.0.0.1:54324');
