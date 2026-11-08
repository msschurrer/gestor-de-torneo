-- Deliberately public read boundary. No raw snapshots, owners, private tournaments or unpublished matches.
create function private.public_tournament_documents() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',t.id,'slug',t.document->'slug','name',t.document->'name','season',t.document->'season',
 'category',t.document->'category','description',t.document->'description','rules',t.document->'rules',
 'status',t.status,'version',t.document->'version','demo',t.document->'demo',
 'settings',t.document->'settings','entrants',t.document->'entrants',
 'matches',coalesce((select jsonb_agg(m) from jsonb_array_elements(t.document->'matches') m where m->>'published'='true'),'[]'::jsonb),
 'visibility','public','access','viewer') order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where t.visibility='public' and t.status<>'draft' and t.deleted_at is null
$$;
revoke all on function private.public_tournament_documents() from public;
grant usage on schema private to anon;
grant execute on function private.public_tournament_documents() to anon,authenticated;
create function public.list_public_tournaments() returns jsonb language sql stable security invoker set search_path='' as $$select private.public_tournament_documents()$$;
revoke all on function public.list_public_tournaments() from public;
grant execute on function public.list_public_tournaments() to anon,authenticated;
