-- Manual operation only, after explicit approval of the account identity.
-- Run through psql, passing both target_user_id and target_email with -v.
-- This file is not a migration and never runs during public registration.
begin;
select set_config('app.bootstrap_user', :'target_user_id', true);
select set_config('app.bootstrap_email', :'target_email', true);
do $$declare target uuid:=current_setting('app.bootstrap_user')::uuid; expected_email text:=lower(current_setting('app.bootstrap_email'));begin
 if not exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id where u.id=target and lower(u.email)=expected_email and u.email_confirmed_at is not null and p.enabled and not coalesce(u.is_anonymous,false)) then raise exception 'La cuenta no coincide, no está confirmada o está deshabilitada';end if;
 insert into private.platform_roles(user_id,role) values(target,'superadmin') on conflict(user_id) do nothing;
 insert into public.audit_logs(actor_user_id,entity_type,entity_id,action,after_json) values(null,'platform_role',target,'explicit_superadmin_assignment',jsonb_build_object('role','superadmin'));
end$$;
commit;
