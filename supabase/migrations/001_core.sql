create schema if not exists private;
create table private.admin_allowlist(email text primary key, created_at timestamptz not null default now());
create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'admin' check(role='admin'),enabled boolean not null default true,created_at timestamptz not null default now());
alter table public.profiles enable row level security;
create policy self_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where user_id=(select auth.uid()) and enabled and role='admin')$$;
revoke all on function public.is_admin() from public;grant execute on function public.is_admin() to anon,authenticated;
-- Only verified accounts invited by the owner receive an administrator profile.
create function private.provision_admin() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.email_confirmed_at is not null and exists(select 1 from private.admin_allowlist where lower(email)=lower(new.email)) then
 insert into public.profiles(user_id) values(new.id) on conflict(user_id) do nothing;
 end if;return new;end$$;
create trigger provision_admin after insert or update of email_confirmed_at on auth.users for each row execute function private.provision_admin();
create table public.tournaments(id uuid primary key,slug text not null unique,name text not null,status text not null check(status in ('draft','published','active','finished','archived')),version integer not null default 1 check(version>0),document jsonb not null check(jsonb_typeof(document)='object'),public_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
create index tournaments_public_idx on public.tournaments(status,updated_at desc) where deleted_at is null;
create table public.categories(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,name text not null);
create table public.phases(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,category_id uuid not null references public.categories on delete cascade,name text not null,type text not null);
create table public.groups(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,phase_id uuid not null references public.phases on delete cascade,name text not null,sort_order integer not null);
create table public.teams(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,name text not null);
create table public.players(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,display_name text not null);
create table public.tournament_teams(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,team_id uuid not null references public.teams on delete cascade,group_id uuid not null references public.groups on delete cascade,unique(tournament_id,team_id));
create table public.roster_entries(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,tournament_team_id uuid not null references public.tournament_teams on delete cascade,player_id uuid not null references public.players on delete cascade,jersey_number integer check(jersey_number between 0 and 99),unique(tournament_team_id,player_id));
create table public.venues(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,name text not null);
create table public.pitches(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,venue_id uuid not null references public.venues on delete cascade,name text not null);
create table public.matchdays(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,phase_id uuid not null references public.phases on delete cascade,round_number integer not null);
create table public.matches(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,phase_id uuid not null references public.phases,matchday_id uuid not null references public.matchdays,home_tournament_team_id uuid not null references public.tournament_teams,away_tournament_team_id uuid not null references public.tournament_teams,kind text not null check(kind in ('internal','interzonal','playoff')),pitch_id uuid references public.pitches,starts_at timestamptz,status text not null,home_score integer check(home_score between 0 and 99),away_score integer check(away_score between 0 and 99),published boolean not null default false,locked boolean not null default false,check(home_tournament_team_id<>away_tournament_team_id));
create table public.match_events(id uuid primary key,tournament_id uuid not null references public.tournaments on delete cascade,match_id uuid not null references public.matches on delete cascade,team_id uuid not null references public.tournament_teams,player_id uuid not null references public.players,type text not null check(type in ('goal','own_goal','yellow','red','second_yellow')),minute integer check(minute between 0 and 180),voided boolean not null default false);
create table public.sanctions(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments on delete cascade,roster_entry_id uuid not null references public.roster_entries,reason text not null,games_total integer not null check(games_total>0),games_served integer not null default 0 check(games_served>=0),status text not null default 'pending');
create table public.fixture_runs(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments on delete cascade,seed integer not null,constraints jsonb not null default '{}',score jsonb not null default '{}',generated_at timestamptz not null default now());
create table public.audit_logs(id bigint generated always as identity primary key,actor_user_id uuid,entity_type text not null,entity_id uuid not null,action text not null,before_json jsonb,after_json jsonb,created_at timestamptz not null default now());
alter table public.tournaments enable row level security;
create policy public_read on public.tournaments for select to anon,authenticated using(deleted_at is null and (status<>'draft' or (select public.is_admin())));
create policy admin_write on public.tournaments for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
alter table public.audit_logs enable row level security;
create policy admin_read on public.audit_logs for select to authenticated using((select public.is_admin()));
-- Immutable audit trail; the trigger has narrowly scoped append authority.
create function private.audit_tournament() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,before_json,after_json) values(auth.uid(),'tournament',new.id,case when tg_op='INSERT' then 'create' when old.status is distinct from new.status then 'status:'||new.status else 'update' end,case when tg_op='UPDATE' then old.document else null end,new.document);return new;end$$;
create trigger audit_tournament after insert or update on public.tournaments for each row execute function private.audit_tournament();
do $$declare t text;begin foreach t in array array['categories','phases','groups','teams','players','tournament_teams','roster_entries','venues','pitches','matchdays','matches','match_events','sanctions','fixture_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create index on public.%I(tournament_id)',t);
 execute format('create policy public_read on public.%I for select to anon,authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.deleted_at is null and (t.status<>''draft'' or (select public.is_admin()))))',t);
 execute format('create policy admin_write on public.%I for all to authenticated using((select public.is_admin())) with check((select public.is_admin()))',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 end loop;end$$;
-- Fixture run diagnostics and sanctions remain private until a dedicated public policy exists.
drop policy public_read on public.fixture_runs;
create policy admin_read on public.fixture_runs for select to authenticated using((select public.is_admin()));
drop policy public_read on public.sanctions;
create policy admin_read on public.sanctions for select to authenticated using((select public.is_admin()));
create index on public.matches(starts_at) where published;
create index on public.match_events(match_id);
create index on public.roster_entries(player_id);
grant select on public.tournaments to anon,authenticated;grant insert,update,delete on public.tournaments to authenticated;grant select on public.profiles,public.audit_logs to authenticated;
create function public.save_tournament(payload jsonb,expected_version integer) returns integer language plpgsql security invoker set search_path='' as $$
declare tid uuid:=(payload->>'id')::uuid; nv integer; cat uuid:=(md5(tid||'category'))::uuid; ph uuid:=(md5(tid||'phase'))::uuid; ven uuid:=(md5(tid||'venue'))::uuid; e jsonb;p jsonb;m jsonb;ev jsonb;g integer;pid uuid;begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501';end if;
 if length(payload->>'name')<3 or (payload->>'status') not in ('draft','published','active','finished','archived') or jsonb_typeof(payload->'entrants')<>'array' or jsonb_typeof(payload->'matches')<>'array' then raise exception 'Datos de torneo inválidos';end if;
 if expected_version=0 then
 insert into public.tournaments(id,slug,name,status,version,document,public_at) values(tid,payload->>'slug',payload->>'name',payload->>'status',1,jsonb_set(payload,'{version}','1'),case when payload->>'status'<>'draft' then now() end);nv:=1;
 else
 update public.tournaments set slug=payload->>'slug',name=payload->>'name',status=payload->>'status',version=version+1,document=jsonb_set(payload,'{version}',to_jsonb(version+1)),updated_at=now(),public_at=case when payload->>'status'<>'draft' then coalesce(public_at,now()) else null end where id=tid and version=expected_version returning version into nv;
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
revoke all on function public.save_tournament(jsonb,integer) from public,anon;grant execute on function public.save_tournament(jsonb,integer) to authenticated;
-- No public registration UI. Only these verified accounts acquire authorization.
insert into private.admin_allowlist(email) values('msschurrer@gmail.com');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crests','crests',true,2097152,array['image/png','image/jpeg','image/webp']);
create policy crest_read on storage.objects for select to anon,authenticated using(bucket_id='crests');
create policy crest_admin on storage.objects for all to authenticated using(bucket_id='crests' and (select public.is_admin())) with check(bucket_id='crests' and (select public.is_admin()));
