-- Private immutable PDF objects. Only the currently saved attachment is public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tournament-rules','tournament-rules',false,4194304,array['application/pdf']);
create or replace function private.can_write_rule_pdf(object_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tournaments t
 where t.id::text=split_part(object_name,'/',1) and t.deleted_at is null
 and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
 and private.edits_tournament(t.id));
$$;
create or replace function private.can_read_rule_pdf(object_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.can_write_rule_pdf(object_name) or exists(
 select 1 from public.tournaments t where t.deleted_at is null
 and t.id::text=split_part(object_name,'/',1)
 and t.visibility='public' and t.status<>'draft'
 and t.document->'settings'->'rulesPdf'->>'path'=object_name);
$$;
revoke all on function private.can_write_rule_pdf(text),private.can_read_rule_pdf(text) from public;
grant execute on function private.can_write_rule_pdf(text),private.can_read_rule_pdf(text) to anon,authenticated;
create policy rules_pdf_read on storage.objects for select to anon,authenticated
using(bucket_id='tournament-rules' and private.can_read_rule_pdf(name));
create policy rules_pdf_insert on storage.objects for insert to authenticated
with check(bucket_id='tournament-rules' and private.can_write_rule_pdf(name));
