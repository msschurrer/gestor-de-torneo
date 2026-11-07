-- The private draft snapshot must never be selectable through the public Data API.
revoke select on public.tournaments from anon,authenticated;
grant select(id,slug,name,status,version,public_at,created_at,updated_at,deleted_at) on public.tournaments to anon,authenticated;
create function public.list_tournaments() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(case when public.is_admin() then t.document else jsonb_set(t.document,'{matches}',coalesce((select jsonb_agg(m) from jsonb_array_elements(t.document->'matches') m where (m->>'published')::boolean),'[]'::jsonb)) end order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where t.deleted_at is null and (public.is_admin() or t.status<>'draft')
$$;
revoke all on function public.list_tournaments() from public;grant execute on function public.list_tournaments() to anon,authenticated;
drop policy public_read on public.matches;
create policy public_read on public.matches for select to anon,authenticated using((select public.is_admin()) or (published and exists(select 1 from public.tournaments t where t.id=tournament_id and t.status<>'draft' and t.deleted_at is null)));
drop policy public_read on public.match_events;
create policy public_read on public.match_events for select to anon,authenticated using((select public.is_admin()) or exists(select 1 from public.matches m where m.id=match_id and m.published));
