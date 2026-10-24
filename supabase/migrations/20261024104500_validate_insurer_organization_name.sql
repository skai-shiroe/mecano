create or replace function public.create_insurer_organization(
  p_name text,
  p_manager_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(btrim(p_name), '');
  normalized_email text := lower(btrim(p_manager_email));
  manager_user_id uuid;
  new_organization_id uuid;
begin
  if (select auth.uid()) is null or not private.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 200 then
    raise exception 'Le nom de l’organisation doit contenir entre 2 et 200 caractères';
  end if;
  if normalized_email is null or char_length(normalized_email) > 320 or position('@' in normalized_email) < 2 then
    raise exception 'Saisis une adresse e-mail valide pour le responsable';
  end if;

  if exists (
    select 1 from public.organizations org
    where org.kind = 'insurer' and lower(org.name) = lower(normalized_name)
  ) then
    raise exception 'Une organisation assureur porte déjà ce nom';
  end if;

  select u.id into manager_user_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = normalized_email
    and u.email_confirmed_at is not null
  order by u.created_at asc
  limit 1;

  if manager_user_id is null then
    raise exception 'Aucun compte Check confirmé ne correspond à cette adresse e-mail';
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    join public.organizations org on org.id = membership.organization_id
    where membership.user_id = manager_user_id
      and membership.is_active
      and org.kind = 'insurer'
      and org.is_active
  ) then
    raise exception 'Ce compte est déjà rattaché à une organisation assureur';
  end if;

  insert into public.organizations (name, kind, is_active)
  values (normalized_name, 'insurer', true)
  returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, is_active)
  values (new_organization_id, manager_user_id, 'manager', true);

  return new_organization_id;
end;
$$;
