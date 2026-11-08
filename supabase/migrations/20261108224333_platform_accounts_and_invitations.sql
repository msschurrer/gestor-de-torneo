-- Additive account migration. No tournament or sporting data is deleted or reassigned.
-- Apply only after backing up production and approving the coordinated application release.
begin;
alter table private.tournament_collaborators add column if not exists enabled boolean not null default true;
create table private.platform_roles(user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role='superadmin'));
alter table private.platform_roles enable row level security;
create table private.tournament_invitations(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments(id),created_by uuid not null references auth.users(id),secret_hash bytea not null unique,label text not null check(length(label) between 1 and 80),expires_at timestamptz not null,accepted_by uuid references auth.users(id),accepted_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now());
alter table private.tournament_invitations enable row level security;
create index invitations_tournament_idx on private.tournament_invitations(tournament_id,created_at desc);
create table private.platform_settings(id boolean primary key default true check(id),value jsonb not null default '{"registrationsOpen":true}');
alter table private.platform_settings enable row level security;
insert into private.platform_settings(id) values(true);
-- Existing profiles keep their role; global authority lives in a separate, ungrantable table.
create or replace function private.is_superadmin() returns boolean language sql stable security definer set search_path='' as $$select private.active_member() and exists(select 1 from private.platform_roles where user_id=auth.uid() and role='superadmin')$$;
create or replace function private.owns_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$select private.active_member() and exists(select 1 from public.tournaments where id=tid and deleted_at is null and (owner_id=auth.uid() or private.is_superadmin()))$$;
create or replace function private.edits_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and (private.owns_tournament(t.id) or exists(select 1 from private.tournament_collaborators c where c.tournament_id=t.id and c.user_id=auth.uid() and c.enabled)))$$;
create or replace function private.protect_ownership() returns trigger language plpgsql set search_path='' as $$begin
 if new.owner_id is distinct from old.owner_id and not (private.is_superadmin() or (private.active_member() and old.owner_id=auth.uid()) or (private.active_member() and old.owner_id is null and new.owner_id=auth.uid() and private.link_role(old.id)='owner')) then raise exception 'No podés cambiar la titularidad' using errcode='42501';end if;
 if (new.visibility is distinct from old.visibility or new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at) and not private.owns_tournament(old.id) then raise exception 'Solo el creador puede publicar, ocultar o eliminar el torneo' using errcode='42501';end if;
 return new;end$$;
-- Block bypassing transactional persistence or changing profile privileges via REST.
revoke insert,update,delete on public.tournaments from authenticated;
revoke all on private.platform_roles,private.tournament_invitations,private.platform_settings from public,anon,authenticated;
-- Retire bearer-link editing after the coordinated release. Legacy creator links can only prove ownership during claim.
revoke execute on function public.save_link_tournament(jsonb,integer),public.manage_tournament_links(uuid,text,uuid,text,text),private.save_link_tournament(jsonb,integer),private.manage_tournament_links(uuid,text,uuid,text,text) from anon,authenticated;
-- Old email grants and write RPC are replaced by the server-validated account workflow.
revoke execute on function public.set_tournament_collaborator(uuid,text,boolean),private.manage_collaborator(uuid,text,boolean),public.save_tournament(jsonb,integer) from anon,authenticated;

create function private.platform_document(tid uuid) returns jsonb language sql stable security definer set search_path='' as $$select (document-'ownerId'-'owner_id'-'access')||jsonb_build_object('visibility',visibility,'access',case when private.owns_tournament(id) then 'owner' else 'editor' end) from public.tournaments where id=tid and private.edits_tournament(tid)$$;
create function private.platform_action(operation text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid; target uuid; inv private.tournament_invitations; doc jsonb; previous jsonb; secret text; nv integer; own boolean;begin
 if not private.active_member() then raise exception 'Ingresá con una cuenta habilitada y correo confirmado' using errcode='42501';end if;
 if operation='me' then return jsonb_build_object('id',auth.uid(),'superadmin',private.is_superadmin());end if;
 if operation='mine' then return coalesce((select jsonb_agg(private.platform_document(id) order by updated_at desc) from public.tournaments where private.edits_tournament(id)),'[]');end if;
 if operation='permissions' then return coalesce((select jsonb_object_agg(id,case when private.owns_tournament(id) then 'owner' else 'editor' end) from public.tournaments where private.edits_tournament(id)),'{}');end if;
 if operation like 'super_%' then
  if not private.is_superadmin() then raise exception 'Solo el superadministrador puede realizar esta acción' using errcode='42501';end if;
  if operation='super_tournaments' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'ownerId',owner_id,'status',status,'deletedAt',deleted_at) order by updated_at desc) from public.tournaments),'[]');
  elsif operation='super_restore' then
   tid:=(args->>'id')::uuid;update public.tournaments set deleted_at=null where id=tid;insert into public.audit_logs(actor_user_id,entity_type,entity_id,action) values(auth.uid(),'administration',tid,'restore');return 'true';
  elsif operation='super_users' then return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'enabled',p.enabled,'superadmin',r.user_id is not null) order by u.created_at desc) from auth.users u join public.profiles p on p.user_id=u.id left join private.platform_roles r on r.user_id=u.id),'[]');
  elsif operation='super_suspend' then
   target:=(args->>'userId')::uuid;if target=auth.uid() or exists(select 1 from private.platform_roles where user_id=target) then raise exception 'No se suspende al superadministrador desde esta pantalla';end if;
   select to_jsonb(p) into previous from public.profiles p where user_id=target;
   update public.profiles set enabled=not coalesce((args->>'suspended')::boolean,true) where user_id=target;
   insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'user',target,'suspend_access',previous,args);return 'true';
  elsif operation='super_settings' then
   if args ? 'settings' then
    select value into previous from private.platform_settings where id=true for update;
    if jsonb_typeof(args->'settings'->'registrationsOpen')<>'boolean' then raise exception 'Configuración inválida';end if;
    update private.platform_settings set value=args->'settings' where id=true;
    insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'platform',auth.uid(),'settings',previous,args->'settings');
   end if;return (select value from private.platform_settings where id=true);
  elsif operation='super_audit' then return coalesce((select jsonb_agg(x) from(select id,actor_user_id,entity_type,entity_id,action,created_at from public.audit_logs order by id desc limit 100)x),'[]');
  end if;
 end if;
 if operation='accept' then
  secret:=args->>'secret';if secret is null or secret!~'^[a-f0-9]{64}$' then raise exception 'Invitación inválida';end if;
  select tournament_id into tid from private.tournament_invitations where secret_hash=sha256(convert_to(secret,'UTF8'));
  perform 1 from public.tournaments where id=tid and deleted_at is null for update;
  select * into inv from private.tournament_invitations where secret_hash=sha256(convert_to(secret,'UTF8')) for update;
  if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() or not exists(select 1 from public.tournaments where id=tid and deleted_at is null) then raise exception 'La invitación venció, ya se utilizó o fue revocada';end if;
  if exists(select 1 from public.tournaments where id=tid and owner_id=auth.uid()) then raise exception 'Ya sos el creador de este torneo';end if;
  insert into private.tournament_collaborators(tournament_id,email,user_id,enabled) select tid,lower(email),id,true from auth.users where id=auth.uid() on conflict(tournament_id,user_id) do update set enabled=true;
  update private.tournament_invitations set accepted_at=now(),accepted_by=auth.uid() where id=inv.id;
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(auth.uid(),'invitation',tid,'accept',jsonb_build_object('invitationId',inv.id,'userId',auth.uid()));
  return private.platform_document(tid);
 end if;
 tid:=coalesce(args->>'id',args->'tournament'->>'id')::uuid;
 if tid is null then raise exception 'Torneo inválido';end if;
 perform 1 from public.tournaments where id=tid for update;
 if operation='claim' then
  if not exists(select 1 from public.tournaments where id=tid and owner_id is null and deleted_at is null) or private.link_role(tid) is distinct from 'owner' then raise exception 'Necesitás el enlace original de creador de un torneo sin titular' using errcode='42501';end if;
  update public.tournaments set owner_id=auth.uid() where id=tid;
  update private.tournament_links set enabled=false where tournament_id=tid;
  return private.platform_document(tid);
 end if;
 if operation='save' then
  doc:=args->'tournament';nv:=(doc->>'version')::integer;
  if nv is null or nv<0 then raise exception 'Versión inválida';end if;
  if nv=0 then
   if not private.is_superadmin() and not coalesce((select(value->>'registrationsOpen')::boolean from private.platform_settings where id=true),true) then raise exception 'La creación de torneos está pausada';end if;
  elsif not private.edits_tournament(tid) then raise exception 'No tenés permiso para editar este torneo' using errcode='42501';end if;
  if nv>0 and not exists(select 1 from public.tournaments where id=tid and version=nv) then raise exception 'Otro administrador guardó cambios. Recargá antes de continuar.' using errcode='PT409';end if;
  if nv>0 and not private.owns_tournament(tid) and exists(select 1 from public.tournaments where id=tid and (visibility is distinct from doc->>'visibility' or status is distinct from doc->>'status')) then raise exception 'Solo el creador puede cambiar publicación o privacidad' using errcode='42501';end if;
  perform public.save_tournament(doc,nv);return private.platform_document(tid);
 end if;
 if not private.edits_tournament(tid) then raise exception 'No tenés permiso para este torneo' using errcode='42501';end if;
 if operation='read' then return private.platform_document(tid);end if;
 if operation='audit' then return coalesce((select jsonb_agg(x) from(select id,actor_user_id,entity_type,action,created_at,before_json,after_json from public.audit_logs where entity_id=tid order by id desc limit 60)x),'[]');end if;
 if not private.owns_tournament(tid) then raise exception 'Solo el creador puede administrar los accesos' using errcode='42501';end if;
 if operation='accesses' then return jsonb_build_object('owner',(select owner_id from public.tournaments where id=tid),'collaborators',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'email',email,'enabled',enabled)) from private.tournament_collaborators where tournament_id=tid),'[]'),'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'expiresAt',expires_at,'acceptedAt',accepted_at,'revokedAt',revoked_at) order by created_at desc) from private.tournament_invitations where tournament_id=tid),'[]'));end if;
 if operation='invite' then
  secret:=args->>'secret';if secret is null or secret!~'^[a-f0-9]{64}$' or char_length(coalesce(args->>'label','')) not between 1 and 80 or coalesce((args->>'days')::integer,0) not between 1 and 30 then raise exception 'Invitación inválida';end if;
  insert into private.tournament_invitations(tournament_id,created_by,secret_hash,label,expires_at) values(tid,auth.uid(),sha256(convert_to(secret,'UTF8')),args->>'label',now()+make_interval(days=>(args->>'days')::integer)) returning * into inv;
  insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(auth.uid(),'invitation',tid,'create',jsonb_build_object('id',inv.id,'expiresAt',inv.expires_at));return jsonb_build_object('id',inv.id,'expiresAt',inv.expires_at);
 elsif operation='revoke_invitation' then
  update private.tournament_invitations set revoked_at=now() where id=(args->>'invitationId')::uuid and tournament_id=tid and accepted_at is null;
 elsif operation='revoke' then
  update private.tournament_collaborators set enabled=false where tournament_id=tid and user_id=(args->>'userId')::uuid;
 elsif operation='transfer' then
  target:=(args->>'userId')::uuid;if target is null or target=auth.uid() or not exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=target and u.email_confirmed_at is not null and p.enabled) then raise exception 'Elegí una cuenta habilitada diferente';end if;
  select jsonb_build_object('ownerId',owner_id) into previous from public.tournaments where id=tid;
  update public.tournaments set owner_id=target where id=tid;
  update private.tournament_invitations set revoked_at=now() where tournament_id=tid and accepted_at is null;
  update private.tournament_links set enabled=false where tournament_id=tid;
  delete from private.tournament_collaborators where tournament_id=tid and user_id=auth.uid();
 elsif operation='delete' then update public.tournaments set deleted_at=now() where id=tid;
 elsif operation='restore' and private.is_superadmin() then update public.tournaments set deleted_at=null where id=tid;
 else raise exception 'Operación inválida';end if;
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'administration',tid,operation,previous,args-'secret');return 'true';
end$$;
create function public.platform_action(operation text,args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.platform_action(operation,args)$$;
revoke all on function private.is_superadmin(),private.platform_document(uuid),private.platform_action(text,jsonb),public.platform_action(text,jsonb) from public,anon;
grant execute on function private.is_superadmin(),private.platform_document(uuid),private.platform_action(text,jsonb),public.platform_action(text,jsonb) to authenticated;
-- Raw relational rows and obsolete snapshot readers must not bypass the public discipline projection.
do $$declare t text;begin foreach t in array array['tournaments','categories','phases','groups','teams','players','tournament_teams','roster_entries','venues','pitches','matchdays','matches','match_events','sanctions','fixture_runs'] loop execute format('revoke all on public.%I from anon,authenticated',t);end loop;end$$;
revoke execute on function public.list_tournaments(),private.tournament_documents(),public.get_link_tournament(uuid),private.get_link_tournament(uuid) from anon,authenticated;
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('manage_tournament_member','set_tournament_member','lookup_tournament_member','find_tournament_member','get_tournament_collaborators','list_collaborators') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end$$;
-- A protected provisioner never reads role or privilege from user_metadata.
create or replace function private.provision_member() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.email_confirmed_at is not null and not coalesce(new.is_anonymous,false) then insert into public.profiles(user_id,role) values(new.id,'member') on conflict(user_id) do nothing;end if;return new;end$$;
commit;
