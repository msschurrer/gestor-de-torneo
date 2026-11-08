-- Multi-tenant integration tests. Synthetic verified users only; everything rolls back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee11','test-owner-one@example.invalid',now(),'{"first_name":"Test","last_name":"Member"}'),
('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee12','test-owner-two@example.invalid',now(),'{"role":"admin","first_name":"Test","last_name":"Member"}'),
('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee13','test-viewer@example.invalid',now(),'{"first_name":"Test","last_name":"Member"}'),
('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14','test-editor@example.invalid',now(),'{"first_name":"Test","last_name":"Member"}');
set local role anon;
do $$begin
 begin perform public.list_tournaments();raise exception 'FAIL anonymous list';exception when insufficient_privilege then null;end;
 begin perform id from public.tournaments;raise exception 'FAIL anonymous REST table read';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee11',true);
set local role authenticated;
select public.save_tournament($payload${"id": "eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21", "slug": "test-owner-one", "name": "Test owner one", "season": "2026", "category": "Primera \u00b7 F\u00fatbol 7", "description": "Diez equipos, dos zonas y una misma pasi\u00f3n. Un torneo de demostraci\u00f3n para descubrir todas las herramientas de Gestor de Torneos.", "rules": "Datos ficticios de demostraci\u00f3n. Fase de zonas a una rueda. Interzonales de libres que suman puntos. Victoria: 3 puntos; empate: 1. Desempate: puntos, diferencia de gol y goles a favor.", "status": "published", "version": 0, "demo": true, "settings": {"groups": 1, "legs": 1, "interzonal": true, "interzonalPoints": true, "interzonalStats": true, "pitches": ["Cancha test"], "slots": ["19:00", "20:00", "21:00"], "duration": 45, "buffer": 15, "startDate": "2026-11-07", "intervalDays": 7, "mode": "rotation", "seed": 42, "win": 3, "draw": 1, "loss": 0, "tieBreakers": ["points", "difference", "goals"], "yellowLimit": 5, "timezone": "America/Argentina/Cordoba"}, "entrants": [], "matches": [], "visibility": "public"}$payload$::jsonb,0);
do $$begin
 if not exists(select 1 from public.tournaments where id='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21' and owner_id=auth.uid()) then raise exception 'FAIL owner not assigned';end if;
 begin update public.tournaments set owner_id='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee12' where id='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21';raise exception 'FAIL owner transfer';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee12',true);
set local role authenticated;
select public.save_tournament($payload${"id": "eeeeeeee-eeee-4eee-aeee-eeeeeeeeee22", "slug": "test-owner-two", "name": "Test owner two", "season": "2026", "category": "Primera \u00b7 F\u00fatbol 7", "description": "Diez equipos, dos zonas y una misma pasi\u00f3n. Un torneo de demostraci\u00f3n para descubrir todas las herramientas de Gestor de Torneos.", "rules": "Datos ficticios de demostraci\u00f3n. Fase de zonas a una rueda. Interzonales de libres que suman puntos. Victoria: 3 puntos; empate: 1. Desempate: puntos, diferencia de gol y goles a favor.", "status": "published", "version": 0, "demo": true, "settings": {"groups": 1, "legs": 1, "interzonal": true, "interzonalPoints": true, "interzonalStats": true, "pitches": ["Cancha test"], "slots": ["19:00", "20:00", "21:00"], "duration": 45, "buffer": 15, "startDate": "2026-11-07", "intervalDays": 7, "mode": "rotation", "seed": 42, "win": 3, "draw": 1, "loss": 0, "tieBreakers": ["points", "difference", "goals"], "yellowLimit": 5, "timezone": "America/Argentina/Cordoba"}, "entrants": [], "matches": [], "visibility": "private"}$payload$::jsonb,0);
do $$begin
 if exists(select 1 from jsonb_array_elements(public.list_tournaments()) x where x->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21' and x->>'access'<>'viewer') then raise exception 'FAIL forged metadata grants access';end if;
 begin perform public.set_tournament_member('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14');raise exception 'FAIL non-owner grants access';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee13',true);
set local role authenticated;
do $$declare p jsonb;begin
 if exists(select 1 from jsonb_array_elements(public.list_tournaments()) x where x->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee22') then raise exception 'FAIL private visible to viewer';end if;
 select value into p from jsonb_array_elements(public.list_tournaments()) where value->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21';
 if p is null or p->>'access'<>'viewer' then raise exception 'FAIL public unavailable to registered viewer';end if;
 begin perform public.save_tournament(p,1);raise exception 'FAIL viewer edits foreign tournament';exception when insufficient_privilege then null;end;
 begin perform document from public.tournaments;raise exception 'FAIL private snapshot selectable';exception when insufficient_privilege then null;end;
 begin insert into public.teams(id,tournament_id,name) values(gen_random_uuid(),'eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','Injected');raise exception 'FAIL cross-tenant projection write';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee11',true);
set local role authenticated;
select public.set_tournament_member('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14');
do $$declare p jsonb;begin
 select value into p from jsonb_array_elements(public.list_tournaments()) where value->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21';
 perform public.save_tournament(jsonb_set(p,'{visibility}','"private"'),1);
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee13',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.tournaments where id='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL private metadata visible';end if;
 if exists(select 1 from public.categories where tournament_id='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL private projection visible';end if;
 if exists(select 1 from jsonb_array_elements(public.list_tournaments()) x where x->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL private JSON visible';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14',true);
set local role authenticated;
do $$declare p jsonb;begin
 select value into p from jsonb_array_elements(public.list_tournaments()) where value->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21';
 if p is null or p->>'access'<>'editor' then raise exception 'FAIL editor private read';end if;
 perform public.save_tournament(p,2);
 begin perform public.save_tournament(p,2);raise exception 'FAIL stale edit';exception when serialization_failure then null;end;
 begin perform public.save_tournament(jsonb_set(p,'{visibility}','"public"'),3);raise exception 'FAIL editor changes privacy';exception when insufficient_privilege then null;end;
 begin perform public.set_tournament_member('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee13');raise exception 'FAIL editor delegates';exception when insufficient_privilege then null;end;
 begin perform public.get_tournament_collaborators('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21');raise exception 'FAIL editor sees invitation emails';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- An unverified account cannot access tournaments, even with a valid authenticated role.
insert into auth.users(id,email,raw_user_meta_data) values('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee15','pending-editor@example.invalid','{"first_name":"New","last_name":"Person","role":"admin"}');
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee15',true);
set local role authenticated;
do $$begin
 if private.active_member() then raise exception 'FAIL unverified member admitted';end if;
 if jsonb_array_length(public.list_tournaments())<>0 then raise exception 'FAIL unverified tournament access';end if;
 if public.can_edit_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL new account inherits editing';end if;
 if not exists(select 1 from public.profiles where user_id=auth.uid() and first_name='New' and last_name='Person') then raise exception 'FAIL name not stored';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee11',true);
set local role authenticated;
select public.set_tournament_member('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14',true);
reset role;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-aeee-eeeeeeeeee14',true);
set local role authenticated;
do $$begin if public.can_edit_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL revocation ineffective';end if;end$$;
reset role;
rollback;
select 'PASS: registration, owner assignment, viewer boundaries, private isolation, forged roles rejected, collaborators, owner-only delegation/privacy, unverified access denied, profile names, no email-based grants, revocation and concurrency' as result;
