-- Registered viewers, tournament ownership, visibility and owner-managed collaborators.
alter table public.tournaments add column owner_id uuid references auth.users(id) on delete restrict default auth.uid();
alter table public.tournaments add column visibility text not null default 'public' check(visibility in ('public','private'));
create index tournaments_owner_idx on public.tournaments(owner_id);
-- Legacy torneos belong to the verified initial organizer, not to every account.
update public.tournaments t set owner_id=(select u.id from auth.users u join private.admin_allowlist a on lower(a.email)=lower(u.email) where u.email_confirmed_at is not null order by u.created_at limit 1) where owner_id is null;
create table private.tournament_collaborators(tournament_id uuid not null references public.tournaments on delete cascade,email text not null,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(tournament_id,email),unique(tournament_id,user_id));
alter table private.tournament_collaborators enable row level security;
create index collaborators_user_idx on private.tournament_collaborators(user_id,tournament_id);
-- Narrow, private permission helpers read the authorization records without recursive RLS.
create function private.active_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null and p.enabled and not coalesce(u.is_anonymous,false))
$$;
create function private.owns_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.owner_id=auth.uid() and t.deleted_at is null)
$$;
create function private.edits_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and (t.owner_id=auth.uid() or exists(select 1 from private.tournament_collaborators c where c.tournament_id=t.id and c.user_id=auth.uid())))
$$;
create function private.reads_tournament(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member() and exists(select 1 from public.tournaments t where t.id=tid and t.deleted_at is null and ((t.visibility='public' and t.status<>'draft') or private.edits_tournament(t.id)))
$$;
revoke all on function private.active_member(),private.owns_tournament(uuid),private.edits_tournament(uuid),private.reads_tournament(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.active_member(),private.owns_tournament(uuid),private.edits_tournament(uuid),private.reads_tournament(uuid) to authenticated;
-- All verified accounts are members. There is no application-wide administrator role.
drop trigger provision_admin on auth.users;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles alter column role set default 'member';
update public.profiles set role='member';
alter table public.profiles add constraint profiles_role_check check(role='member');
create function private.provision_member() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.email_confirmed_at is not null and not coalesce(new.is_anonymous,false) then
 insert into public.profiles(user_id,role) values(new.id,'member') on conflict(user_id) do nothing;
 update private.tournament_collaborators set user_id=new.id where email=lower(new.email) and user_id is null;

 end if;return new;end$$;
create trigger provision_member after insert or update of email_confirmed_at,email on auth.users for each row execute function private.provision_member();
insert into public.profiles(user_id,role) select id,'member' from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous,false) on conflict(user_id) do nothing;
-- Remove all legacy global-admin and anonymous policies, including projections.
do $$declare p record;begin for p in select tablename,policyname from pg_policies where schemaname='public' and tablename<>'profiles' loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end$$;
revoke all on all tables in schema public from anon;
revoke execute on function public.is_admin(),public.list_tournaments() from anon;
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$select false$$;
create policy member_read on public.tournaments for select to authenticated using(private.reads_tournament(id));
create policy owner_create on public.tournaments for insert to authenticated with check(private.active_member() and owner_id=(select auth.uid()));
create policy scoped_update on public.tournaments for update to authenticated using(private.edits_tournament(id)) with check(private.edits_tournament(id));
-- Protect ownership and privacy even from direct REST writes by collaborators.
create function private.protect_ownership() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.owner_id is distinct from old.owner_id then raise exception 'No se permite transferir la propiedad del torneo' using errcode='42501';end if;
 if new.visibility is distinct from old.visibility and not private.owns_tournament(old.id) then raise exception 'Solo el propietario puede cambiar la privacidad' using errcode='42501';end if;
 return new;end$$;
create trigger protect_ownership before update on public.tournaments for each row execute function private.protect_ownership();
grant select(owner_id,visibility) on public.tournaments to authenticated;
revoke delete on public.tournaments from authenticated;
create policy scoped_audit on public.audit_logs for select to authenticated using(private.edits_tournament(entity_id));
do $$declare t text;begin foreach t in array array['categories','phases','groups','teams','players','tournament_teams','roster_entries','venues','pitches','matchdays','matches','match_events','sanctions','fixture_runs'] loop
 execute format('create policy scoped_read on public.%I for select to authenticated using(private.reads_tournament(tournament_id))',t);
 execute format('create policy scoped_write on public.%I for all to authenticated using(private.edits_tournament(tournament_id)) with check(private.edits_tournament(tournament_id))',t);
 end loop;end$$;
-- Hide unpublished match rows from viewers; editors still see their own drafts.
drop policy scoped_read on public.matches;
create policy scoped_read on public.matches for select to authenticated using(private.edits_tournament(tournament_id) or (published and private.reads_tournament(tournament_id)));
drop policy scoped_read on public.match_events;
create policy scoped_read on public.match_events for select to authenticated using(private.edits_tournament(tournament_id) or exists(select 1 from public.matches m where m.id=match_id and m.published));
drop policy scoped_read on public.sanctions;drop policy scoped_read on public.fixture_runs;
-- Listing is a narrow private read boundary; the public wrapper itself is invoker.
create function private.tournament_documents() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg((case when private.edits_tournament(t.id) then t.document else jsonb_set(t.document,'{matches}',coalesce((select jsonb_agg(m) from jsonb_array_elements(t.document->'matches') m where (m->>'published')::boolean),'[]'::jsonb)) end - 'ownerId' - 'owner_id' - 'access') || jsonb_build_object('visibility',t.visibility,'access',case when private.owns_tournament(t.id) then 'owner' when private.edits_tournament(t.id) then 'editor' else 'viewer' end) order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where private.reads_tournament(t.id)
$$;
revoke all on function private.tournament_documents() from public,anon;grant execute on function private.tournament_documents() to authenticated;
create or replace function public.list_tournaments() returns jsonb language sql stable security invoker set search_path='' as $$select private.tournament_documents()$$;
revoke all on function public.list_tournaments() from public,anon;grant execute on function public.list_tournaments() to authenticated;
create function public.can_edit_tournament(tid uuid) returns boolean language sql stable security invoker set search_path='' as $$select private.edits_tournament(tid)$$;
revoke all on function public.can_edit_tournament(uuid) from public,anon;grant execute on function public.can_edit_tournament(uuid) to authenticated;
create function private.manage_collaborator(tid uuid,collaborator_email text,remove_access boolean) returns void language plpgsql security definer set search_path='' as $$
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
end$$;
create function private.list_collaborators(tid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.owns_tournament(tid) then raise exception 'Solo el propietario puede ver los accesos' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('email',email,'status',case when user_id is null then 'pending' else 'active' end,'createdAt',created_at) order by created_at) from private.tournament_collaborators where tournament_id=tid),'[]'::jsonb);
end$$;
revoke all on function private.manage_collaborator(uuid,text,boolean),private.list_collaborators(uuid) from public,anon;
grant execute on function private.manage_collaborator(uuid,text,boolean),private.list_collaborators(uuid) to authenticated;
create function public.set_tournament_collaborator(tid uuid,collaborator_email text,remove_access boolean default false) returns void language sql security invoker set search_path='' as $$select private.manage_collaborator(tid,collaborator_email,remove_access)$$;
create function public.get_tournament_collaborators(tid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_collaborators(tid)$$;
revoke all on function public.set_tournament_collaborator(uuid,text,boolean),public.get_tournament_collaborators(uuid) from public,anon;
grant execute on function public.set_tournament_collaborator(uuid,text,boolean),public.get_tournament_collaborators(uuid) to authenticated;
-- Access to files follows the tournament in the first folder of each object path.
drop policy crest_read on storage.objects;drop policy crest_admin on storage.objects;
update storage.buckets set public=false where id='crests';
create function private.path_tournament(path text) returns uuid language plpgsql immutable set search_path='' as $$begin return split_part(path,'/',1)::uuid;exception when invalid_text_representation then return null;end$$;
revoke all on function private.path_tournament(text) from public,anon;grant execute on function private.path_tournament(text) to authenticated;
create policy crest_read on storage.objects for select to authenticated using(bucket_id='crests' and private.reads_tournament(private.path_tournament(name)));
create policy crest_write on storage.objects for all to authenticated using(bucket_id='crests' and private.edits_tournament(private.path_tournament(name))) with check(bucket_id='crests' and private.edits_tournament(private.path_tournament(name)));

create or replace function public.save_tournament(payload jsonb,expected_version integer) returns integer language plpgsql security invoker set search_path='' as $$
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
 return nv;end$$;

revoke all on function private.provision_member() from public,anon,authenticated;
