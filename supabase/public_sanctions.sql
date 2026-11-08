create or replace function private.public_tournament_documents() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',t.id,'slug',t.document->'slug','name',t.document->'name','season',t.document->'season',
 'category',t.document->'category','description',t.document->'description','rules',t.document->'rules',
 'status',t.status,'version',t.document->'version','demo',t.document->'demo',
 'settings',t.document->'settings','entrants',t.document->'entrants',
 'sanctions',coalesce(t.document->'sanctions','[]'::jsonb),
 'matches',coalesce((select jsonb_agg(m) from jsonb_array_elements(t.document->'matches') m where m->>'published'='true'),'[]'::jsonb),
 'visibility','public','access','viewer') order by t.updated_at desc),'[]'::jsonb)
 from public.tournaments t where t.visibility='public' and t.status<>'draft' and t.deleted_at is null
$$;