CREATE OR REPLACE FUNCTION private.tournament_documents()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg((case when private.edits_tournament(t.id) then t.document else jsonb_set(t.document,'{matches}',coalesce((select jsonb_agg(m) from jsonb_array_elements(t.document->'matches') m where (m->>'published')::boolean),'[]'::jsonb)) end - 'ownerId' - 'owner_id' - 'access') || jsonb_build_object('visibility',t.visibility,'access',case when private.owns_tournament(t.id) then 'owner' when private.edits_tournament(t.id) then 'editor' else 'viewer' end) order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where private.reads_tournament(t.id)
$function$;

CREATE OR REPLACE FUNCTION private.reads_tournament(tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and ((t.visibility='public' and t.status<>'draft') or private.edits_tournament(t.id)))
$function$;

CREATE OR REPLACE FUNCTION public.list_tournaments()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select private.tournament_documents()$function$;

CREATE OR REPLACE FUNCTION public.can_edit_tournament(tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select private.edits_tournament(tid)$function$;

CREATE OR REPLACE FUNCTION private.protect_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin
 if new.owner_id is distinct from old.owner_id then raise exception 'No se permite transferir la propiedad del torneo' using errcode='42501';end if;
 if new.visibility is distinct from old.visibility and not private.owns_tournament(old.id) then raise exception 'Solo el propietario puede cambiar la privacidad' using errcode='42501';end if;
 return new;end$function$;

CREATE OR REPLACE FUNCTION private.provision_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if new.email_confirmed_at is not null and exists(select 1 from private.admin_allowlist where lower(email)=lower(new.email)) then
 insert into public.profiles(user_id) values(new.id) on conflict(user_id) do nothing;
 end if;return new;end$function$;

CREATE OR REPLACE FUNCTION private.audit_tournament()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'tournament',new.id,case when tg_op='INSERT' then 'create' when old.status is distinct from new.status then 'status:'||new.status else 'update' end,case when tg_op='UPDATE' then old.document else null end,new.document);return new;end$function$;

CREATE OR REPLACE FUNCTION private.edits_tournament(tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and (t.owner_id=auth.uid() or exists(select 1 from private.tournament_collaborators c where c.tournament_id=t.id and c.user_id=auth.uid() and c.enabled)))
$function$;

CREATE OR REPLACE FUNCTION private.active_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null and p.enabled and not coalesce(u.is_anonymous,false))
$function$;

CREATE OR REPLACE FUNCTION private.owns_tournament(tid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(private.link_role(tid)='owner',false) or (private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.owner_id=auth.uid() and t.deleted_at is null))
$function$;

CREATE OR REPLACE FUNCTION private.provision_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare given text:=trim(coalesce(new.raw_user_meta_data->>'first_name',''));family text:=trim(coalesce(new.raw_user_meta_data->>'last_name',''));begin
 if not coalesce(new.is_anonymous,false) then
 if tg_op='INSERT' and (length(given)<1 or length(family)<1 or length(given)>80 or length(family)>80) then raise exception 'Ingresá tu nombre y apellido (hasta 80 caracteres cada uno)';end if;
 insert into public.profiles(user_id,role,first_name,last_name) values(new.id,'member',left(given,80),left(family,80)) on conflict(user_id) do update set first_name=excluded.first_name,last_name=excluded.last_name;
 end if;return new;end$function$;

CREATE OR REPLACE FUNCTION public.set_tournament_collaborator(tid uuid, collaborator_email text, remove_access boolean DEFAULT false)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$select private.manage_collaborator(tid,collaborator_email,remove_access)$function$;

CREATE OR REPLACE FUNCTION public.get_tournament_collaborators(tid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select private.list_collaborators(tid)$function$;

CREATE OR REPLACE FUNCTION private.manage_collaborator(tid uuid, collaborator_email text, remove_access boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare normalized text:=lower(trim(collaborator_email)); target uuid; previous jsonb;begin
 -- Serialize permission changes with tournament updates and with each other.
 perform 1 from public.tournaments where id=tid for update;
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede administrar colaboradores' using errcode='42501';end if;
 if normalized!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254 then raise exception 'Correo electrónico inválido';end if;
 if exists(select 1 from auth.users where id=auth.uid() and lower(email)=normalized) then raise exception 'Ya sos el propietario del torneo';end if;
 select to_jsonb(c) into previous from private.tournament_collaborators c where tournament_id=tid and email=normalized;
 if remove_access then delete from private.tournament_collaborators where tournament_id=tid and email=normalized;
 else
 select id into target from auth.users where lower(email)=normalized and email_confirmed_at is not null and not coalesce(is_anonymous,false);
 insert into private.tournament_collaborators(tournament_id,email,user_id) values(tid,normalized,target) on conflict(tournament_id,email) do update set user_id=excluded.user_id;
 end if;
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'collaborator',tid,case when remove_access then 'revoke_access' else 'grant_access' end,previous,jsonb_build_object('email',normalized));
end$function$;

CREATE OR REPLACE FUNCTION private.path_tournament(path text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$begin return split_part(path,'/',1)::uuid;exception when invalid_text_representation then return null;end$function$;

CREATE OR REPLACE FUNCTION public.save_tournament(payload jsonb, expected_version integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare tid uuid:=(payload->>'id')::uuid; nv integer; cat uuid:=(md5(tid||'category'))::uuid; ph uuid:=(md5(tid||'phase'))::uuid; ven uuid:=(md5(tid||'venue'))::uuid; e jsonb;p jsonb;m jsonb;ev jsonb;g integer;pid uuid;begin
 if not private.active_member() or (expected_version<>0 and not private.edits_tournament(tid)) then raise exception 'No tenés permiso para editar este torneo' using errcode='42501';end if;
 payload:=payload-'access'-'ownerId'-'owner_id';
 if coalesce(payload->>'visibility','public') not in ('public','private') then raise exception 'Visibilidad inválida';end if;
 if length(payload->>'name')<3 or (payload->>'status') not in ('draft','published','active','finished','archived') or jsonb_typeof(payload->'entrants')<>'array' or jsonb_typeof(payload->'matches')<>'array' then raise exception 'Datos de torneo inválidos';end if;
 if expected_version=0 then
 insert into public.tournaments(id,slug,name,status,version,document,public_at,owner_id,visibility) values(tid,payload->>'slug',payload->>'name',payload->>'status',1,jsonb_set(payload,'{version}','1'),case when payload->>'status'<>'draft' then now() end,auth.uid(),coalesce(payload->>'visibility','public'));nv:=1;
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
 return nv;end$function$;

CREATE OR REPLACE FUNCTION private.list_collaborators(tid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede ver los accesos' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'email',u.email,'name',coalesce(nullif(trim(p.first_name||' '||p.last_name),''),'Usuario existente'),'createdAt',c.created_at) order by c.created_at) from private.tournament_collaborators c join auth.users u on u.id=c.user_id join public.profiles p on p.user_id=c.user_id where tournament_id=tid and c.enabled),'[]'::jsonb);
end$function$;

CREATE OR REPLACE FUNCTION private.lookup_tournament_member(tid uuid, member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede buscar colaboradores' using errcode='42501';end if;
 return (select jsonb_build_object('id',u.id,'email',u.email,'name',coalesce(nullif(trim(p.first_name||' '||p.last_name),''),'Usuario existente')) from auth.users u join public.profiles p on p.user_id=u.id where u.id=member_id and p.enabled and not coalesce(u.is_anonymous,false));
end$function$;

CREATE OR REPLACE FUNCTION private.manage_tournament_member(tid uuid, member_id uuid, remove_access boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target jsonb;begin
 perform 1 from public.tournaments where id=tid for update;
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede administrar colaboradores' using errcode='42501';end if;
 if member_id=auth.uid() then raise exception 'Ya sos el propietario del torneo';end if;
 if remove_access then update private.tournament_collaborators set enabled=false where tournament_id=tid and user_id=member_id;
 else
 target:=private.lookup_tournament_member(tid,member_id);
 if target is null then raise exception 'La cuenta no existe o está deshabilitada. Pedile a la persona que se registre y te pase su código de usuario.';end if;
 insert into private.tournament_collaborators(tournament_id,email,user_id,enabled) values(tid,'account:'||member_id,member_id,true) on conflict(tournament_id,user_id) do update set enabled=true;
 end if;
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(auth.uid(),'collaborator',tid,case when remove_access then 'revoke_access' else 'grant_access' end,jsonb_build_object('user_id',member_id));
end$function$;

CREATE OR REPLACE FUNCTION private.link_secret()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-tournament-key','')$function$;

CREATE OR REPLACE FUNCTION private.public_tournament_documents()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',t.id,'slug',t.document->'slug','name',t.document->'name','season',t.document->'season',
 'category',t.document->'category','description',t.document->'description','rules',t.document->'rules',
 'status',t.status,'version',t.document->'version','demo',t.document->'demo',
 'settings',t.document->'settings','entrants',t.document->'entrants',
 'publicDiscipline',coalesce(t.document->'publicDiscipline','true'::jsonb),
 'sanctions',case when coalesce((t.document->>'publicDiscipline')::boolean,true) then coalesce(t.document->'sanctions','[]'::jsonb) else '[]'::jsonb end,
 'matches',coalesce((select jsonb_agg(case when coalesce((t.document->>'publicDiscipline')::boolean,true) then m else m||jsonb_build_object('events',coalesce((select jsonb_agg(e) from jsonb_array_elements(m->'events') e where e->>'type' in ('goal','own_goal')),'[]'::jsonb),'note','') end) from jsonb_array_elements(t.document->'matches') m where m->>'published'='true'),'[]'::jsonb),
 'visibility','public','access','viewer') order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where t.visibility='public' and t.status<>'draft' and t.deleted_at is null
$function$;

CREATE OR REPLACE FUNCTION private.link_role(tid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select l.role from private.tournament_links l join public.tournaments t on t.id=l.tournament_id where l.tournament_id=tid and l.enabled and t.deleted_at is null and length(private.link_secret())=64 and l.secret_hash=sha256(convert_to(private.link_secret(),'UTF8')) limit 1
$function$;

CREATE OR REPLACE FUNCTION private.get_link_tournament(tid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 declare access_role text:=private.link_role(tid);begin
 if access_role is null then raise exception 'El enlace no es válido o fue revocado' using errcode='42501';end if;
 return (select (document-'ownerId'-'owner_id'-'access')||jsonb_build_object('visibility',visibility,'access',access_role) from public.tournaments where id=tid and deleted_at is null);
end$function$;

CREATE OR REPLACE FUNCTION private.save_link_tournament(payload jsonb, expected_version integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 return nv;end$function$;

CREATE OR REPLACE FUNCTION private.manage_tournament_links(tid uuid, operation text, link_id uuid DEFAULT NULL::uuid, label text DEFAULT NULL::text, new_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 end$function$;
