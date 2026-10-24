-- Keep accepted invitation history valid if a user account is later removed.
alter table public.organization_invitations
  drop constraint organization_invitations_check;
alter table public.organization_invitations
  add constraint organization_invitations_acceptance_state_check
  check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted' and accepted_at is null and accepted_by is null)
  );

-- Re-check the manager after taking the organization lock so two managers
-- cannot deactivate each other concurrently and leave the organization orphaned.
create or replace function public.set_insurer_member_active(
  p_organization_id uuid,
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
  active_manager_count integer;
begin
  if (select auth.uid()) is null or not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;

  perform 1 from public.organizations organization
  where organization.id = p_organization_id and organization.kind = 'insurer'
  for update;
  if not found then
    raise exception 'Organisation assureur introuvable';
  end if;
  if not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;

  select membership.role into target_role
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id and membership.user_id = p_user_id
  for update;
  if target_role is null then
    raise exception 'Membre introuvable';
  end if;
  if not p_is_active and target_role = 'manager' then
    select count(*) into active_manager_count
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.role = 'manager' and membership.is_active;
    if active_manager_count <= 1 then
      raise exception 'L’organisation doit conserver au moins un responsable actif';
    end if;
  end if;

  update public.organization_memberships
  set is_active = p_is_active
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;

revoke all on function public.set_insurer_member_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_insurer_member_active(uuid, uuid, boolean) to authenticated;
