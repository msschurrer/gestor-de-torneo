-- Possession-based tournament access without accounts. Only token hashes are persisted server-side.
create table private.tournament_links(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments(id) on delete cascade,secret_hash bytea not null unique,role text not null check(role in ('owner','editor')),label text not null check(length(label) between 1 and 80),enabled boolean not null default true,created_at timestamptz not null default now());
create unique index one_link_owner on private.tournament_links(tournament_id) where role='owner';
alter table private.tournament_links enable row level security;
revoke all on private.tournament_links from public,anon,authenticated;
create function private.link_secret() returns text language sql stable set search_path='' as $$select coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-tournament-key','')$$;
create function private.link_role(tid uuid) returns text language sql stable security definer set search_path='' as $$
 select l.role from private.tournament_links l join public.tournaments t on t.id=l.tournament_id where l.tournament_id=tid and l.enabled and t.deleted_at is null and length(private.link_secret())=64 and l.secret_hash=sha256(convert_to(private.link_secret(),'UTF8')) limit 1
$$;
-- Existing authenticated ownership is preserved. A scoped creator link also authorizes privacy changes.
create or replace function private.owns_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(private.link_role(tid)='owner',false) or (private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.owner_id=auth.uid() and t.deleted_at is null))
$$;
create function private.get_link_tournament(tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare access_role text:=private.link_role(tid);begin
 if access_role is null then raise exception 'El enlace no es válido o fue revocado' using errcode='42501';end if;
 return (select (document-'ownerId'-'owner_id'-'access')||jsonb_build_object('visibility',visibility,'access',access_role) from public.tournaments where id=tid and deleted_at is null);
end$$;
create function private.manage_tournament_links(tid uuid,operation text,link_id uuid default null,label text default null,new_secret text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 begin
 perform 1 from public.tournaments where id=tid for update;
 if private.link_role(tid) is distinct from 'owner' then raise exception 'Solo el creador puede administrar accesos' using errcode='42501';end if;
 if operation='create' then
 if new_secret is null or new_secret!~'^[a-f0-9]{64}$' or label is null or length(trim(label)) not between 1 and 80 then raise exception 'Datos de acceso inválidos';end if;
 insert into private.tournament_links(tournament_id,secret_hash,role,label) values(tid,sha256(convert_to(new_secret,'UTF8')),'editor',trim(label));
 elsif operation='revoke' then
 update private.tournament_links set enabled=false where id=link_id and tournament_id=tid and role='editor';
 elsif operation<>'list' then raise exception 'Operación inválida';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',l.label,'enabled',enabled,'createdAt',created_at) order by created_at) from private.tournament_links l where tournament_id=tid and role='editor'),'[]'::jsonb);
 end$$;
create or replace function private.save_link_tournament(payload jsonb,expected_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare tid uuid:=(payload->>'id')::uuid; nv integer; cat uuid:=(md5(tid||'category'))::uuid; ph uuid:=(md5(tid||'phase'))::uuid; ven uuid:=(md5(tid||'venue'))::uuid; e jsonb;p jsonb;m jsonb;ev jsonb;g integer;pid uuid;begin
 if expected_version<0 or (expected_version=0 and private.link_secret()!~'^[a-f0-9]{64}$') or (expected_version<>0 and private.link_role(tid) is null) then raise exception 'No tenés permiso para editar este torneo' using errcode='42501';end if;
 if expected_version<>0 then
 perform 1 from public.tournaments where id=tid for update;
 if private.link_role(tid) is null then raise exception 'Acceso revocado' using errcode='42501';end if;
 if private.link_role(tid)<>'owner' and (payload->>'visibility') is distinct from (select visibility from public.tournaments where id=tid) then raise exception 'Solo el creador puede cambiar la privacidad' using errcode='42501';end if;
 end if;
 payload:=payload-'access'-'ownerId'-'owner_id';
 if coalesce(payload->>'visibility','public') not in ('public','private') then raise exception 'Visibilidad inválida';end if;
 if length(payload->>'name')<3 or (payload->>'status') not in ('draft','published','active','finished','archived') or jsonb_typeof(payload->'entrants')<>'array' or jsonb_typeof(payload->'matches')<>'array' then raise exception 'Datos de torneo inválidos';end if;
 if expected_version=0 then
 insert into public.tournaments(id,slug,name,status,version,document,public_at,owner_id,visibility) values(tid,payload->>'slug',payload->>'name',payload->>'status',1,jsonb_set(payload,'{version}','1'),case when payload->>'status'<>'draft' then now() end,null,coalesce(payload->>'visibility','public'));nv:=1;
 insert into private.tournament_links(tournament_id,secret_hash,role,label) values(tid,sha256(convert_to(private.link_secret(),'UTF8')),'owner','Creador');
 else
 update public.tournaments set visibility=coalesce(payload->>'visibility','public'),slug=payload->>'slug',name=payload->>'name',status=payload->>'status',version=version+1,document=jsonb_set(payload,'{version}',to_jsonb(version+1)),updated_at=now(),public_at=case when payload->>'status'<>'draft' then coalesce(public_at,now()) else null end where id=tid and version=expected_version returning version into nv;
 if nv is null then raise exception 'CONFLICT: Otro administrador modificó el torneo. Recargá antes de guardar.' using errcode='40001';end if;
 end if;
 -- The snapshot and its indexed relational projection change in the same transaction.
 delete from public.match_events where tournament_id=tid;delete from public.matches where tournament_id=tid;delete from public.sanctions where tournament_id=tid;delete from public.roster_entries where tournament_id=tid;delete from public.tournament_teams where tournament_id=tid;delete from public.players where tournament_id=tid;delete from public.teams where tournament_id=tid;delete from public.groups where tournament_id=tid;delete from public.matchdays where tournament_id=tid;delete from public.phases where tournament_id=tid;delete from public.categories where tournament_id=tid;delete from public.pitches where tournament_id=tid;delete from public.venues where tournament_id=tid;
 insert into public.categories values(cat,tid,payload->>'category');insert into public.phases values(ph,tid,cat,'Fase de zonas','round_robin');
 for g in 0..((payload->'settings'->>'groups')::integer-1) loop insert into public.groups values(md5(tid||'group'||g)::uuid,tid,ph,'Zona '||chr(65+g),g);end loop;
 insert into public.venues values(ven,tid,'Sede principal');
 for p in select * from jsonb_array_elements(payload->'settings'->'pitches') loop insert into public.pitches values(md5(tid||'pitch'||(p#>>'{}'))::uuid,tid,ven,p#>>'{}');end loop;
 for e in select * from jsonb_array_elements(payload->'entrants') loop
 insert into public.teams values((e->>'id')::uuid,tid,e->>'name');insert into public.tournament_teams values((e->>'id')::uuid,tid,(e->>'id')::uuid,md5(tid||'group'||(e->>'group'))::uuid);
 for p in select * from jsonb_array_elements(e->'players') loop insert into public.players values((p->>'id')::uuid,tid,p->>'name');insert into public.roster_entries values(md5((e->>'id')||(p->>'id'))::uuid,tid,(e->>'id')::uuid,(p->>'id')::uuid,(p->>'number')::integer);end loop;end loop;
 for g in select distinct (value->>'round')::integer from jsonb_array_elements(payload->'matches') loop insert into public.matchdays values(md5(tid||'round'||g)::uuid,tid,ph,g);end loop;
 for m in select * from jsonb_array_elements(payload->'matches') loop
 pid:=case when m->>'pitch'<>'' then md5(tid||'pitch'||(m->>'pitch'))::uuid else null end;
 insert into public.matches values((m->>'id')::uuid,tid,ph,md5(tid||'round'||(m->>'round'))::uuid,(m->>'home')::uuid,(m->>'away')::uuid,m->>'kind',pid,nullif(m->>'startsAt','')::timestamptz,m->>'status',(m->>'homeScore')::integer,(m->>'awayScore')::integer,(m->>'published')::boolean,(m->>'locked')::boolean);
 for ev in select * from jsonb_array_elements(m->'events') loop insert into public.match_events values((ev->>'id')::uuid,tid,(m->>'id')::uuid,(ev->>'teamId')::uuid,(ev->>'playerId')::uuid,ev->>'type',(ev->>'minute')::integer,coalesce((ev->>'voided')::boolean,false));end loop;end loop;
 return nv;end$$;

create function public.get_link_tournament(tid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.get_link_tournament(tid)$$;
create function public.save_link_tournament(payload jsonb,expected_version integer) returns integer language sql security invoker set search_path='' as $$select private.save_link_tournament(payload,expected_version)$$;
create function public.manage_tournament_links(tid uuid,operation text,link_id uuid default null,label text default null,new_secret text default null) returns jsonb language sql security invoker set search_path='' as $$select private.manage_tournament_links(tid,operation,link_id,label,new_secret)$$;
revoke all on function private.link_secret(),private.link_role(uuid),private.get_link_tournament(uuid),private.save_link_tournament(jsonb,integer),private.manage_tournament_links(uuid,text,uuid,text,text),public.get_link_tournament(uuid),public.save_link_tournament(jsonb,integer),public.manage_tournament_links(uuid,text,uuid,text,text) from public;
grant execute on function private.get_link_tournament(uuid),private.save_link_tournament(jsonb,integer),private.manage_tournament_links(uuid,text,uuid,text,text),public.get_link_tournament(uuid),public.save_link_tournament(jsonb,integer),public.manage_tournament_links(uuid,text,uuid,text,text) to anon,authenticated;
