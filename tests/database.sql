-- Run in Supabase SQL Editor after migrations + seed. Everything rolls back.
begin;
insert into auth.users(id,email) values('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee1','authorized-test@example.invalid'),('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee2','unauthorized-test@example.invalid');
insert into public.profiles(user_id) values('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee1');
insert into public.tournaments(id,slug,name,status,document) values('eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee3','private-rls-test','Private test','draft','{"matches":[],"name":"Private test"}');
set local role anon;
do $$begin
 if exists(select 1 from jsonb_array_elements(public.list_tournaments()) t where t->>'name'='Private test') then raise exception 'FAIL draft exposed';end if;
 begin insert into public.tournaments(id,slug,name,status,document) values(gen_random_uuid(),'anon-write','Anon','draft','{}');raise exception 'FAIL anon write allowed';exception when insufficient_privilege then null;end;
 begin perform document from public.tournaments;raise exception 'FAIL private snapshot exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee2',true);
set local role authenticated;
do $$begin if public.is_admin() then raise exception 'FAIL unauthorized user admin';end if;
 begin perform public.save_tournament('{}',0);raise exception 'FAIL unauthorized save allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeeee1',true);
set local role authenticated;
do $$declare payload jsonb; v integer;begin
 if not public.is_admin() then raise exception 'FAIL authorized user blocked';end if;
 select value into payload from jsonb_array_elements(public.list_tournaments()) where value->>'slug'='copa-encuentro-2026';
 v:=public.save_tournament(payload,(payload->>'version')::integer);
 if v<>(payload->>'version')::integer+1 then raise exception 'FAIL version';end if;
 begin perform public.save_tournament(payload,(payload->>'version')::integer);raise exception 'FAIL stale write accepted';exception when serialization_failure then null;end;
 if (select count(*) from public.matches where tournament_id=(payload->>'id')::uuid)<>25 then raise exception 'FAIL missing fixtures';end if;
 if (select count(*) from public.match_events where tournament_id=(payload->>'id')::uuid)<>5 then raise exception 'FAIL duplicated events';end if;
end$$;
reset role;
rollback;
select 'PASS: anon blocked, unauthorized blocked, draft hidden, private snapshot hidden, admin save, concurrency conflict, events not duplicated' as result;
