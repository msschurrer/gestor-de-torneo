-- Require confirmed email for all tournament access, including existing sessions.
create or replace function private.active_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null and p.enabled and not coalesce(u.is_anonymous,false))
$$;
