-- Temporary anonymous read access for the public web pilot.
-- Remove these grants/policies when authentication and subscriptions are restored.
-- Source quality alerts remain intact; exact PM/LI/LS values are published as reference data.

alter table public.reference_prices drop constraint if exists reference_prices_check1;
alter table public.reference_prices add constraint reference_prices_published_values_check
  check (status <> 'published' or (
    pm > 0 and li > 0 and ls > 0
    and tax_basis <> 'unknown'
    and matching_verified
    and published_at is not null
  ));

create or replace function private.entry_is_approved(entry_id uuid, product_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.reference_entries e
    join public.source_families f on f.id = e.source_family_id
    join public.categories c on c.id = coalesce(e.category_id, f.category_id)
    join public.products p on p.id = product_id and p.category_id = c.id and p.unit_code = e.unit_code
    where e.id = entry_id and e.review_status = 'approved' and c.is_active
      and (e.category_id is not null or f.mapping_status = 'approved')
  );
$$;

create or replace function private.guard_reference_publication() returns trigger
language plpgsql set search_path = '' as $$
declare entry public.reference_entries%rowtype; family public.source_families%rowtype; product public.products%rowtype;
begin
  if tg_op = 'UPDATE' and old.published_at is not null
     and (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Create a new revision to change an already published price';
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
    if row(new.pm, new.li, new.ls, new.currency, new.tax_basis) is distinct from row(entry.pm, entry.li, entry.ls, entry.currency, entry.tax_basis)
      and nullif(btrim(new.correction_note), '') is null then
      raise exception 'Document corrections without changing the raw source';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

grant select on public.products, public.reference_prices, public.reference_sources to anon;

create policy products_public_web_preview_select on public.products for select to anon using (
  status = 'published' and exists (
    select 1 from public.categories c where c.id = category_id and c.is_active
  )
);
create policy prices_public_web_preview_select on public.reference_prices for select to anon using (
  status = 'published'
  and (valid_from is null or valid_from <= current_date)
  and (valid_until is null or valid_until >= current_date)
  and exists (
    select 1 from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = product_id and p.status = 'published' and c.is_active
  )
);
create policy sources_public_web_preview_select on public.reference_sources for select to anon using (
  exists (
    select 1 from public.reference_prices p
    where p.source_id = id and p.status = 'published'
      and (p.valid_from is null or p.valid_from <= current_date)
      and (p.valid_until is null or p.valid_until >= current_date)
  )
);
