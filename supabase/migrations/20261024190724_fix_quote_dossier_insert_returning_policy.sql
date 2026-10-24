drop policy if exists dossiers_scoped_select on public.quote_dossiers;
create policy dossiers_scoped_select
on public.quote_dossiers
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or (
    created_by = (select auth.uid())
    and organization_id is not null
    and (select private.has_insurer_workspace_access(organization_id))
  )
  or (select private.can_access_insurer_dossier(id))
);
