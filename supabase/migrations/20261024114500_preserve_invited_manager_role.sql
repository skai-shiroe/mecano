-- A pending member invitation must never downgrade a manager who was added
-- through another authorized workflow while the invitation was open.
create or replace function public.accept_insurer_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  invitation public.organization_invitations%rowtype;
  candidate_hash text;
begin
  if current_user_id is null then
    raise exception 'Connecte-toi avec Google avant d’accepter cette invitation';
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Lien d’invitation invalide';
  end if;

  select lower(account.email) into current_email
  from auth.users account
  where account.id = current_user_id and account.email_confirmed_at is not null;
  if current_email is null then
    raise exception 'Un compte Google confirmé est requis';
  end if;

  candidate_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select * into invitation
  from public.organization_invitations candidate
  where candidate.token_hash = candidate_hash
    and candidate.status = 'pending'
    and candidate.expires_at > now()
  for update;
  if not found then
    raise exception 'Cette invitation est expirée, révoquée ou déjà utilisée';
  end if;
  if invitation.email <> current_email then
    raise exception 'Connecte-toi avec l’adresse e-mail à laquelle cette invitation a été adressée';
  end if;
  if not exists (
    select 1 from public.organizations organization
    where organization.id = invitation.organization_id and organization.kind = 'insurer' and organization.is_active
  ) then
    raise exception 'Cette organisation n’est plus active';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, is_active)
  values (invitation.organization_id, current_user_id, invitation.role, true)
  on conflict (organization_id, user_id) do update
    set role = case
          when public.organization_memberships.is_active and public.organization_memberships.role = 'manager'
            then 'manager'
          else excluded.role
        end,
        is_active = true;

  update public.organization_invitations
  set status = 'accepted', accepted_by = current_user_id, accepted_at = now()
  where id = invitation.id;

  return invitation.organization_id;
end;
$$;

revoke all on function public.accept_insurer_organization_invitation(text) from public, anon;
grant execute on function public.accept_insurer_organization_invitation(text) to authenticated;
