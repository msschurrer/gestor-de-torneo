-- Product decision: immediate email/password registration, no email verification.
alter table public.profiles add column first_name text not null default '' check(length(first_name)<=80);
alter table public.profiles add column last_name text not null default '' check(length(last_name)<=80);
create or replace function private.active_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=auth.uid() and p.enabled and not coalesce(u.is_anonymous,false))
$$;
-- Never bind an invitation from an unverified email address.
create or replace function private.provision_member() returns trigger language plpgsql security definer set search_path='' as $$
declare given text:=trim(coalesce(new.raw_user_meta_data->>'first_name',''));family text:=trim(coalesce(new.raw_user_meta_data->>'last_name',''));begin
 if not coalesce(new.is_anonymous,false) then
 if tg_op='INSERT' and (length(given)<1 or length(family)<1 or length(given)>80 or length(family)>80) then raise exception 'Ingresá tu nombre y apellido (hasta 80 caracteres cada uno)';end if;
 insert into public.profiles(user_id,role,first_name,last_name) values(new.id,'member',left(given,80),left(family,80)) on conflict(user_id) do update set first_name=excluded.first_name,last_name=excluded.last_name;
 end if;return new;end$$;
create trigger sync_member_names after update of raw_user_meta_data on auth.users for each row execute function private.provision_member();
insert into public.profiles(user_id,role,first_name,last_name) select id,'member',left(trim(coalesce(raw_user_meta_data->>'first_name','')),80),left(trim(coalesce(raw_user_meta_data->>'last_name','')),80) from auth.users where not coalesce(is_anonymous,false) on conflict(user_id) do nothing;
-- Keep legacy invitation records for audit, but never activate them by email.
revoke execute on function public.set_tournament_collaborator(uuid,text,boolean),private.manage_collaborator(uuid,text,boolean) from public,anon,authenticated;
alter table private.tournament_collaborators add column enabled boolean not null default true;
create or replace function private.edits_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and (t.owner_id=auth.uid() or exists(select 1 from private.tournament_collaborators c where c.tournament_id=t.id and c.user_id=auth.uid() and c.enabled)))
$$;
create function private.lookup_tournament_member(tid uuid,member_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede buscar colaboradores' using errcode='42501';end if;
 return (select jsonb_build_object('id',u.id,'email',u.email,'name',coalesce(nullif(trim(p.first_name||' '||p.last_name),''),'Usuario existente')) from auth.users u join public.profiles p on p.user_id=u.id where u.id=member_id and p.enabled and not coalesce(u.is_anonymous,false));
end$$;
create function private.manage_tournament_member(tid uuid,member_id uuid,remove_access boolean) returns void language plpgsql security definer set search_path='' as $$
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
end$$;
create or replace function private.list_collaborators(tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede ver los accesos' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'email',u.email,'name',coalesce(nullif(trim(p.first_name||' '||p.last_name),''),'Usuario existente'),'createdAt',c.created_at) order by c.created_at) from private.tournament_collaborators c join auth.users u on u.id=c.user_id join public.profiles p on p.user_id=c.user_id where tournament_id=tid and c.enabled),'[]'::jsonb);
end$$;
revoke all on function private.lookup_tournament_member(uuid,uuid),private.manage_tournament_member(uuid,uuid,boolean) from public,anon;
grant execute on function private.lookup_tournament_member(uuid,uuid),private.manage_tournament_member(uuid,uuid,boolean) to authenticated;
create function public.lookup_tournament_member(tid uuid,member_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.lookup_tournament_member(tid,member_id)$$;
create function public.set_tournament_member(tid uuid,member_id uuid,remove_access boolean default false) returns void language sql security invoker set search_path='' as $$select private.manage_tournament_member(tid,member_id,remove_access)$$;
revoke all on function public.lookup_tournament_member(uuid,uuid),public.set_tournament_member(uuid,uuid,boolean) from public,anon;
grant execute on function public.lookup_tournament_member(uuid,uuid),public.set_tournament_member(uuid,uuid,boolean) to authenticated;
