begin;
select set_config('request.headers',jsonb_build_object('x-tournament-key',repeat('a',64))::text,true);
set local role anon;
select public.save_link_tournament(jsonb_set(jsonb_set($payload${"id": "eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21", "slug": "test-owner-one", "name": "Test owner one", "season": "2026", "category": "Primera \u00b7 F\u00fatbol 7", "description": "Diez equipos, dos zonas y una misma pasi\u00f3n. Un torneo de demostraci\u00f3n para descubrir todas las herramientas de Gestor de Torneos.", "rules": "Datos ficticios de demostraci\u00f3n. Fase de zonas a una rueda. Interzonales de libres que suman puntos. Victoria: 3 puntos; empate: 1. Desempate: puntos, diferencia de gol y goles a favor.", "status": "published", "version": 0, "demo": true, "settings": {"groups": 1, "legs": 1, "interzonal": true, "interzonalPoints": true, "interzonalStats": true, "pitches": ["Cancha test"], "slots": ["19:00", "20:00", "21:00"], "duration": 45, "buffer": 15, "startDate": "2026-11-07", "intervalDays": 7, "mode": "rotation", "seed": 42, "win": 3, "draw": 1, "loss": 0, "tieBreakers": ["points", "difference", "goals"], "yellowLimit": 5, "timezone": "America/Argentina/Cordoba"}, "entrants": [], "matches": [], "visibility": "public"}$payload$::jsonb,'{status}','"draft"'),'{visibility}','"private"'),0);
select public.manage_tournament_links('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','create',null,'Planillero',repeat('b',64));
select set_config('request.headers',jsonb_build_object('x-tournament-key',repeat('c',64))::text,true);
do $$begin
 begin perform public.get_link_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21');raise exception 'FAIL guessed ID';exception when insufficient_privilege then null;end;
 if exists(select 1 from jsonb_array_elements(public.list_public_tournaments()) x where x->>'id'='eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21') then raise exception 'FAIL private leaked';end if;
end$$;
select set_config('request.headers',jsonb_build_object('x-tournament-key',repeat('b',64))::text,true);
do $$declare p jsonb;begin
 p:=public.get_link_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21');
 if p->>'access'<>'editor' then raise exception 'FAIL editor role';end if;
 perform public.save_link_tournament(jsonb_set(p,'{name}','"Editado por colaborador"'),1);
 begin perform public.save_link_tournament(jsonb_set(p,'{visibility}','"public"'),2);raise exception 'FAIL editor privacy';exception when insufficient_privilege then null;end;
 begin perform public.manage_tournament_links('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','create',null,'Intruso',repeat('d',64));raise exception 'FAIL editor delegation';exception when insufficient_privilege then null;end;
 begin perform public.get_link_tournament('00000000-0000-4000-a000-000000000001');raise exception 'FAIL cross tournament read';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.headers',jsonb_build_object('x-tournament-key',repeat('a',64))::text,true);
do $$declare p jsonb; lid uuid;begin
 p:=public.get_link_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21');
 if p->>'name'<>'Editado por colaborador' or p->>'access'<>'owner' then raise exception 'FAIL owner restore';end if;
 select (x->>'id')::uuid into lid from jsonb_array_elements(public.manage_tournament_links('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','list')) x limit 1;
 perform public.manage_tournament_links('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21','revoke',lid);
 perform public.save_link_tournament(jsonb_set(p,'{visibility}','"public"'),2);
 begin perform public.save_link_tournament(p,2);raise exception 'FAIL stale write';exception when serialization_failure then null;end;
end$$;
select set_config('request.headers',jsonb_build_object('x-tournament-key',repeat('b',64))::text,true);
do $$begin
 begin perform public.get_link_tournament('eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21');raise exception 'FAIL revoked read';exception when insufficient_privilege then null;end;
 begin perform public.save_link_tournament($payload${"id": "eeeeeeee-eeee-4eee-aeee-eeeeeeeeee21", "slug": "test-owner-one", "name": "Test owner one", "season": "2026", "category": "Primera \u00b7 F\u00fatbol 7", "description": "Diez equipos, dos zonas y una misma pasi\u00f3n. Un torneo de demostraci\u00f3n para descubrir todas las herramientas de Gestor de Torneos.", "rules": "Datos ficticios de demostraci\u00f3n. Fase de zonas a una rueda. Interzonales de libres que suman puntos. Victoria: 3 puntos; empate: 1. Desempate: puntos, diferencia de gol y goles a favor.", "status": "published", "version": 0, "demo": true, "settings": {"groups": 1, "legs": 1, "interzonal": true, "interzonalPoints": true, "interzonalStats": true, "pitches": ["Cancha test"], "slots": ["19:00", "20:00", "21:00"], "duration": 45, "buffer": 15, "startDate": "2026-11-07", "intervalDays": 7, "mode": "rotation", "seed": 42, "win": 3, "draw": 1, "loss": 0, "tieBreakers": ["points", "difference", "goals"], "yellowLimit": 5, "timezone": "America/Argentina/Cordoba"}, "entrants": [], "matches": [], "visibility": "public"}$payload$::jsonb,3);raise exception 'FAIL revoked write';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS creator, collaborator editing, recovery, scoped private reads, privacy, delegation denied, revocation and conflicts' as result;
