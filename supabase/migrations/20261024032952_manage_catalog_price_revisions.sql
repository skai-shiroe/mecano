-- Historical, traceable updates for prices that change over time.
-- Only active catalog administrators can publish a new revision.
create or replace function private.guard_reference_publication() returns trigger
language plpgsql set search_path = '' as $$
declare
  entry public.reference_entries%rowtype;
  family public.source_families%rowtype;
  product public.products%rowtype;
begin
  if tg_op = 'UPDATE' and old.published_at is not null
     and (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    -- A published row can only be closed as a historical revision. Its original
    -- price, source, author and publication timestamp stay immutable.
    if not (
      old.status = 'published'
      and new.status = 'retired'
      and (to_jsonb(new) - 'status' - 'updated_at' - 'valid_until')
          is not distinct from
          (to_jsonb(old) - 'status' - 'updated_at' - 'valid_until')
    ) then
      raise exception 'Create a new revision to change an already published price';
    end if;
  end if;

  if new.status = 'published' then
    select * into strict entry from public.reference_entries where id = new.reference_entry_id for share;
    select * into strict family from public.source_families where id = entry.source_family_id for share;
    select * into strict product from public.products where id = new.product_id for share;
    if entry.review_status <> 'approved' then raise exception 'Approve the source entry first'; end if;
    if product.status <> 'published' or not exists (
      select 1 from public.categories where id = product.category_id and is_active
    ) then raise exception 'Publish the product in an active category first'; end if;
    if coalesce(entry.category_id, family.category_id) is distinct from product.category_id
      or (entry.category_id is null and family.mapping_status <> 'approved') then
      raise exception 'Approve the source entry classification or family mapping first';
    end if;
    if entry.unit_code <> new.unit_code then raise exception 'Unit conversion requires a separate verified mapping'; end if;
    if row(new.pm, new.li, new.ls, new.currency, new.tax_basis)
      is distinct from row(entry.pm, entry.li, entry.ls, entry.currency, entry.tax_basis)
      and nullif(btrim(new.correction_note), '') is null then
      raise exception 'Document corrections without changing the raw source';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.can_manage_catalog_prices()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_catalog_admin();
$$;

revoke all on function public.can_manage_catalog_prices() from public, anon, authenticated;
grant execute on function public.can_manage_catalog_prices() to authenticated;

create or replace function public.publish_price_revision(
  p_reference_price_id uuid,
  p_pm numeric,
  p_li numeric,
  p_ls numeric,
  p_correction_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_price public.reference_prices%rowtype;
  next_revision integer;
  new_price_id uuid;
  closed_on date;
begin
  if auth.uid() is null or not private.is_catalog_admin() then
    raise insufficient_privilege using message = 'Catalog administrator access is required';
  end if;

  if p_pm is null or p_li is null or p_ls is null
     or p_pm <= 0 or p_li <= 0 or p_ls <= 0
     or p_pm >= 'Infinity'::numeric or p_li >= 'Infinity'::numeric or p_ls >= 'Infinity'::numeric
     or p_li > p_pm or p_pm > p_ls then
    raise check_violation using message = 'Enter positive prices with minimum ≤ average ≤ maximum';
  end if;

  if nullif(btrim(p_correction_note), '') is null
     or char_length(btrim(p_correction_note)) > 1000 then
    raise check_violation using message = 'A revision note of at most 1000 characters is required';
  end if;

  select * into current_price
  from public.reference_prices p
  where p.id = p_reference_price_id and p.status = 'published'
  for update;

  if not found then
    raise no_data_found using message = 'The published price was not found or has already changed';
  end if;

  if row(p_pm, p_li, p_ls) is not distinct from row(current_price.pm, current_price.li, current_price.ls) then
    raise check_violation using message = 'Change at least one price value';
  end if;

  closed_on := case
    when current_price.valid_from is null then current_date - 1
    else greatest(current_price.valid_from, current_date - 1)
  end;

  update public.reference_prices
  set status = 'retired',
      valid_until = closed_on,
      updated_at = now()
  where id = current_price.id;

  select coalesce(max(p.revision), 0) + 1 into next_revision
  from public.reference_prices p
  where p.reference_entry_id = current_price.reference_entry_id
    and p.product_id = current_price.product_id;

  insert into public.reference_prices (
    product_id,
    unit_code,
    source_id,
    reference_entry_id,
    revision,
    pm,
    li,
    ls,
    currency,
    tax_basis,
    matching_verified,
    correction_note,
    status,
    published_by,
    published_at,
    valid_from
  )
  values (
    current_price.product_id,
    current_price.unit_code,
    current_price.source_id,
    current_price.reference_entry_id,
    next_revision,
    p_pm,
    p_li,
    p_ls,
    current_price.currency,
    current_price.tax_basis,
    current_price.matching_verified,
    btrim(p_correction_note),
    'published',
    auth.uid(),
    now(),
    current_date
  )
  returning id into new_price_id;

  return new_price_id;
end;
$$;

revoke all on function public.publish_price_revision(uuid, numeric, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.publish_price_revision(uuid, numeric, numeric, numeric, text) to authenticated;

comment on function public.publish_price_revision(uuid, numeric, numeric, numeric, text)
is 'Atomically retires an active price and publishes a traceable, administrator-only revision.';
comment on function public.can_manage_catalog_prices()
is 'Returns true only for an authenticated active owner or catalog administrator.';
