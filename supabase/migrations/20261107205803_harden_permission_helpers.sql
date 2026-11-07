create policy deny_direct_access on private.tournament_collaborators for all to authenticated using(false) with check(false);
revoke all on function private.provision_admin(),private.audit_tournament(),private.protect_ownership() from public,anon,authenticated;
