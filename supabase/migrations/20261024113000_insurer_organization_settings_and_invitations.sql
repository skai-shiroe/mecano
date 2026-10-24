-- Organization profile, managed invitations and basic team access for insurer workspaces.
alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists city text,
  add column if not exists accent_color text not null default 'blue';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_insurer_accent_color_check'
  ) then
    alter table public.organizations
      add constraint organizations_insurer_accent_color_check
      check (accent_color in ('blue', 'indigo', 'teal', 'green', 'violet', 'slate'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_contact_email_check'
  ) then
    alter table public.organizations
      add constraint organizations_contact_email_check
      check (contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_contact_phone_check'
  ) then
    alter table public.organizations
      add constraint organizations_contact_phone_check
      check (contact_phone is null or contact_phone ~ '^[+0-9() .-]{6,30}$');
  end if;
end;
$$;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null default 'member' check (role in ('member', 'manager')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null and accepted_by is not null))
);

create index if not exists organization_invitations_manager_list_idx
  on public.organization_invitations (organization_id, created_at desc);
create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, email)
  where status = 'pending';
create index if not exists organization_invitations_expiry_idx
  on public.organization_invitations (expires_at)
  where status = 'pending';

alter table public.organization_invitations enable row level security;
revoke all on table public.organization_invitations from public, anon, authenticated;
grant select on table public.organization_invitations to authenticated;
create policy organization_invitations_manager_select
  on public.organization_invitations for select to authenticated
  using ((select private.is_org_manager(organization_id)));

create trigger organization_invitations_touch_updated_at
  before update on public.organization_invitations
  for each row execute function private.touch_updated_at();

create or replace function public.update_insurer_organization_settings(
  p_organization_id uuid,
  p_name text,
  p_contact_email text,
  p_contact_phone text,
  p_city text,
  p_accent_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(btrim(p_name), '');
  normalized_email text := nullif(lower(btrim(p_contact_email)), '');
  normalized_phone text := nullif(btrim(p_contact_phone), '');
  normalized_city text := nullif(btrim(p_city), '');
begin
  if (select auth.uid()) is null or not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;
  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 200 then
    raise exception 'Le nom doit contenir entre 2 et 200 caractères';
  end if;
  if normalized_email is not null and normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if normalized_phone is not null and normalized_phone !~ '^[+0-9() .-]{6,30}$' then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if normalized_city is not null and char_length(normalized_city) > 120 then
    raise exception 'Le nom de la ville est trop long';
  end if;
  if p_accent_color not in ('blue', 'indigo', 'teal', 'green', 'violet', 'slate') then
    raise exception 'Couleur de thème invalide';
  end if;

  update public.organizations
  set name = normalized_name,
      contact_email = normalized_email,
      contact_phone = normalized_phone,
      city = normalized_city,
      accent_color = p_accent_color
  where id = p_organization_id and kind = 'insurer' and is_active;

  if not found then
    raise exception 'Organisation assureur introuvable ou inactive';
  end if;
end;
$$;

create or replace function public.get_insurer_organization_members(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  is_active boolean,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;
  return query
    select membership.user_id,
      account.email::text,
      coalesce(nullif(profile.display_name, ''), split_part(account.email, '@', 1))::text,
      membership.role,
      membership.is_active,
      membership.created_at
    from public.organization_memberships membership
    join auth.users account on account.id = membership.user_id
    left join public.profiles profile on profile.id = membership.user_id
    where membership.organization_id = p_organization_id
    order by (membership.role = 'manager') desc, membership.is_active desc, profile.display_name nulls last, account.email;
end;
$$;

create or replace function public.get_insurer_organization_invitations(p_organization_id uuid)
returns table (
  id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;
  return query
    select invitation.id, invitation.email, invitation.role, invitation.status,
      invitation.created_at, invitation.expires_at
    from public.organization_invitations invitation
    where invitation.organization_id = p_organization_id
    order by invitation.created_at desc
    limit 50;
end;
$$;

create or replace function public.create_insurer_organization_invitation(
  p_organization_id uuid,
  p_email text
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  new_invitation_id uuid;
  new_expiration timestamptz := now() + interval '7 days';
begin
  if (select auth.uid()) is null or not private.is_org_manager(p_organization_id) then
    raise exception 'Manager access required';
  end if;
  if normalized_email is null or char_length(normalized_email) > 320
    or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if not exists (
    select 1 from public.organizations organization
    where organization.id = p_organization_id and organization.kind = 'insurer' and organization.is_active
  ) then
    raise exception 'Organisation assureur introuvable ou inactive';
  end if;
  if exists (
    select 1 from public.organization_memberships membership
    join auth.users account on account.id = membership.user_id
    where membership.organization_id = p_organization_id and membership.is_active
      and lower(account.email) = normalized_email
  ) then
    raise exception 'Cette personne est déjà membre de l’organisation';
  end if;

  update public.organization_invitations
  set status = 'revoked'
  where organization_id = p_organization_id and email = normalized_email and status = 'pending';

  insert into public.organization_invitations (
    organization_id, email, role, token_hash, status, created_by, expires_at
  ) values (
    p_organization_id, normalized_email, 'member',
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), 'pending', auth.uid(), new_expiration
  ) returning id into new_invitation_id;

  return query select new_invitation_id, raw_token, new_expiration;
end;
$$;

create or replace function public.revoke_insurer_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select invitation.organization_id into target_organization_id
  from public.organization_invitations invitation
  where invitation.id = p_invitation_id;
  if target_organization_id is null or (select auth.uid()) is null
    or not private.is_org_manager(target_organization_id) then
    raise exception 'Manager access required';
  end if;

  update public.organization_invitations
  set status = 'revoked'
  where id = p_invitation_id and status = 'pending';
  if not found then
    raise exception 'Cette invitation n’est plus en attente';
  end if;
end;
$$;

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
    set role = excluded.role, is_active = true;

  update public.organization_invitations
  set status = 'accepted', accepted_by = current_user_id, accepted_at = now()
  where id = invitation.id;

  return invitation.organization_id;
end;
$$;

revoke all on function public.update_insurer_organization_settings(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.get_insurer_organization_members(uuid) from public, anon;
revoke all on function public.get_insurer_organization_invitations(uuid) from public, anon;
revoke all on function public.create_insurer_organization_invitation(uuid, text) from public, anon;
revoke all on function public.revoke_insurer_organization_invitation(uuid) from public, anon;
revoke all on function public.set_insurer_member_active(uuid, uuid, boolean) from public, anon;
revoke all on function public.accept_insurer_organization_invitation(text) from public, anon;
grant execute on function public.update_insurer_organization_settings(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.get_insurer_organization_members(uuid) to authenticated;
grant execute on function public.get_insurer_organization_invitations(uuid) to authenticated;
grant execute on function public.create_insurer_organization_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_insurer_organization_invitation(uuid) to authenticated;
grant execute on function public.set_insurer_member_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.accept_insurer_organization_invitation(text) to authenticated;
