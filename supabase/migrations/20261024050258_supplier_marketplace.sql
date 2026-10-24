-- Supplier onboarding and verified offer management for the Check pilot.
-- Orders and payment capture are intentionally separate from this migration.

create table public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  organization_name text not null check (char_length(btrim(organization_name)) between 2 and 200),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 200),
  contact_email text not null check (contact_email = lower(contact_email) and char_length(contact_email) <= 320),
  contact_phone text not null check (char_length(btrim(contact_phone)) between 6 and 40),
  city text not null check (char_length(btrim(city)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  specialties text[] not null default '{}',
  service_zones text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(service_zones) > 0),
  check ((status = 'pending' and reviewed_at is null and reviewed_by is null and organization_id is null)
    or (status = 'approved' and reviewed_at is not null and reviewed_by is not null and organization_id is not null)
    or (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and organization_id is null))
);

create unique index supplier_applications_one_open_per_user_idx
  on public.supplier_applications(applicant_user_id)
  where status in ('pending', 'approved');
create index supplier_applications_pending_idx
  on public.supplier_applications(created_at desc)
  where status = 'pending';

create table public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  brand text check (brand is null or char_length(brand) <= 160),
  condition text not null default 'new' check (condition in ('new', 'reconditioned', 'used')),
  quality text not null default 'equivalent' check (quality in ('original', 'equivalent', 'reconditioned', 'used')),
  unit_price numeric(14,2) not null check (unit_price > 0),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  tax_basis text not null check (tax_basis in ('HT', 'TTC', 'unknown')),
  availability text not null default 'unknown' check (availability in ('available', 'on_order', 'out_of_stock', 'unknown')),
  stock_quantity numeric(14,3) check (stock_quantity is null or stock_quantity >= 0),
  delivery_zone text not null check (char_length(btrim(delivery_zone)) between 2 and 200),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  delivery_currency text not null default 'XOF' check (delivery_currency ~ '^[A-Z]{3}$'),
  delivery_days_min integer check (delivery_days_min is null or delivery_days_min >= 0),
  delivery_days_max integer check (delivery_days_max is null or delivery_days_max >= 0),
  verified_at timestamptz not null default now(),
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected', 'paused')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (delivery_days_min is null or delivery_days_max is null or delivery_days_max >= delivery_days_min),
  check (delivery_currency = currency),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.supplier_offer_reviews (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.supplier_offers(id) on delete cascade,
  decision text not null check (decision in ('published', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index supplier_offer_reviews_offer_created_idx
  on public.supplier_offer_reviews(offer_id, created_at desc);
create index supplier_offers_product_public_idx
  on public.supplier_offers(product_id, unit_price)
  where status = 'published';
create index supplier_offers_org_status_idx
  on public.supplier_offers(supplier_organization_id, status, updated_at desc);

create function private.is_active_supplier_member(target_organization uuid default null)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and o.is_active
      and o.kind = 'supplier'
      and (target_organization is null or m.organization_id = target_organization)
  );
$$;

revoke execute on function private.is_active_supplier_member(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_active_supplier_member(uuid) to authenticated;

alter table public.supplier_applications enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.supplier_offer_reviews enable row level security;

revoke all on public.supplier_applications, public.supplier_offers, public.supplier_offer_reviews from public, anon, authenticated;
grant select on public.supplier_applications to authenticated;
grant insert (
  organization_name, contact_name, contact_email, contact_phone, city, description, specialties, service_zones
) on public.supplier_applications to authenticated;
grant select, insert, update, delete on public.supplier_applications, public.supplier_offers, public.supplier_offer_reviews to service_role;
grant select on public.supplier_offers to authenticated, anon;
grant select on public.supplier_offer_reviews to authenticated;
grant insert (
  supplier_organization_id, product_id, brand, condition, quality,
  unit_price, currency, tax_basis, availability, stock_quantity, delivery_zone, delivery_fee,
  delivery_currency, delivery_days_min, delivery_days_max, valid_until
) on public.supplier_offers to authenticated;
grant update (
  product_id, brand, condition, quality, unit_price, currency, tax_basis,
  availability, stock_quantity, delivery_zone, delivery_fee, delivery_currency,
  delivery_days_min, delivery_days_max, valid_until
) on public.supplier_offers to authenticated;

create policy supplier_applications_scoped_select on public.supplier_applications
  for select to authenticated
  using (applicant_user_id = (select auth.uid()) or (select private.is_catalog_admin()));
create policy supplier_applications_owner_insert on public.supplier_applications
  for insert to authenticated
  with check (
    applicant_user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and organization_id is null
  );
create policy supplier_applications_admin_select on public.supplier_applications
  for select to authenticated
  using ((select private.is_catalog_admin()));

create policy supplier_offers_public_select on public.supplier_offers
  for select to anon, authenticated
  using (
    status = 'published'
    and verified_at >= statement_timestamp() - interval '30 days'
    and (valid_until is null or valid_until >= current_date)
    and exists (
      select 1 from public.organizations o
      where o.id = supplier_organization_id and o.kind = 'supplier' and o.is_active
    )
    and exists (
      select 1 from public.products p
      join public.categories c on c.id = p.category_id
      where p.id = product_id and p.status = 'published' and c.is_active
    )
  );
create policy supplier_offers_owner_select on public.supplier_offers
  for select to authenticated
  using (
    (select private.is_active_supplier_member(supplier_organization_id))
    or (select private.is_catalog_admin())
  );
create policy supplier_offers_owner_insert on public.supplier_offers
  for insert to authenticated
  with check (
    (select private.is_active_supplier_member(supplier_organization_id))
    and status = 'draft'
    and published_at is null
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );
create policy supplier_offers_owner_update on public.supplier_offers
  for update to authenticated
  using ((select private.is_active_supplier_member(supplier_organization_id)))
  with check (
    (select private.is_active_supplier_member(supplier_organization_id))
    and status in ('draft', 'pending_review', 'published', 'rejected', 'paused')
  );
create policy supplier_offers_owner_delete on public.supplier_offers
  for delete to authenticated
  using (
    (select private.is_active_supplier_member(supplier_organization_id))
    and status in ('draft', 'rejected', 'paused')
  );
create policy supplier_offers_admin_select on public.supplier_offers
  for select to authenticated
  using ((select private.is_catalog_admin()));
create policy supplier_offer_reviews_scoped_select on public.supplier_offer_reviews
  for select to authenticated
  using (
    (select private.is_catalog_admin())
    or exists (
      select 1
      from public.supplier_offers offer
      where offer.id = offer_id
        and (select private.is_active_supplier_member(offer.supplier_organization_id))
    )
  );

-- Supplier company names are public only after Check activates a supplier account.
grant select on public.organizations to anon;
create policy organizations_supplier_public_select on public.organizations
  for select to anon, authenticated
  using (kind = 'supplier' and is_active);
create policy organizations_admin_select on public.organizations
  for select to authenticated
  using ((select private.is_catalog_admin()));

-- A supplier needs the validated product list to prepare offers, even before
-- a commercial subscription is selected for supplier accounts.
drop policy if exists products_authorized_select on public.products;
create policy products_authorized_select on public.products
  for select to authenticated
  using (
    (select private.is_catalog_admin())
    or (
      status = 'published'
      and (
        (select private.has_any_catalog_access())
        or (select private.is_active_supplier_member(null::uuid))
      )
      and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
    )
  );

create function private.guard_supplier_offer_update()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if (old.product_id, old.brand, old.condition, old.quality, old.unit_price,
      old.currency, old.tax_basis, old.delivery_zone, old.delivery_fee, old.delivery_currency,
      old.delivery_days_min, old.delivery_days_max, old.valid_until)
    is distinct from
     (new.product_id, new.brand, new.condition, new.quality, new.unit_price,
      new.currency, new.tax_basis, new.delivery_zone, new.delivery_fee, new.delivery_currency,
      new.delivery_days_min, new.delivery_days_max, new.valid_until) then
    if old.status = 'published' then
      new.status := 'pending_review';
      new.published_at := null;
    end if;
  end if;

  if (old.availability, old.stock_quantity) is distinct from (new.availability, new.stock_quantity) then
    new.verified_at := statement_timestamp();
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger supplier_offers_guard_update
  before update on public.supplier_offers
  for each row execute function private.guard_supplier_offer_update();

create trigger supplier_applications_touch_updated_at
  before update on public.supplier_applications
  for each row execute function private.touch_updated_at();

create trigger supplier_offers_audit
  after insert or update or delete on public.supplier_offers
  for each row execute function private.audit_change();

create function public.submit_supplier_offer(p_offer_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  offer_organization uuid;
  offer_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select o.supplier_organization_id, o.status
    into offer_organization, offer_status
  from public.supplier_offers o
  where o.id = p_offer_id
  for update;

  if offer_organization is null
    or not private.is_active_supplier_member(offer_organization) then
    raise exception 'Supplier offer not found';
  end if;
  if offer_status not in ('draft', 'rejected', 'paused') then
    raise exception 'This offer cannot be submitted from its current status';
  end if;

  update public.supplier_offers
  set status = 'pending_review',
      published_at = null,
      verified_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_offer_id;
end;
$$;

revoke execute on function public.submit_supplier_offer(uuid) from public, anon;
grant execute on function public.submit_supplier_offer(uuid) to authenticated;

create function public.set_supplier_offer_paused(p_offer_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  offer_organization uuid;
  offer_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select o.supplier_organization_id, o.status
    into offer_organization, offer_status
  from public.supplier_offers o
  where o.id = p_offer_id
  for update;

  if offer_organization is null
    or not private.is_active_supplier_member(offer_organization) then
    raise exception 'Supplier offer not found';
  end if;

  if p_paused and offer_status = 'published' then
    update public.supplier_offers
    set status = 'paused', published_at = null, updated_at = statement_timestamp()
    where id = p_offer_id;
    return;
  end if;

  if not p_paused and offer_status = 'paused' then
    update public.supplier_offers
    set status = 'pending_review', published_at = null,
        verified_at = statement_timestamp(), updated_at = statement_timestamp()
    where id = p_offer_id;
    return;
  end if;

  raise exception 'This offer cannot change pause state from its current status';
end;
$$;

revoke execute on function public.set_supplier_offer_paused(uuid, boolean) from public, anon;
grant execute on function public.set_supplier_offer_paused(uuid, boolean) to authenticated;

create function public.review_supplier_application(
  p_application_id uuid,
  p_approved boolean,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  application public.supplier_applications%rowtype;
  new_organization_id uuid;
begin
  if (select auth.uid()) is null or not private.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into application
  from public.supplier_applications
  where id = p_application_id
  for update;

  if not found or application.status <> 'pending' then
    raise exception 'Supplier application is no longer pending';
  end if;
  if not p_approved and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'A short reason is required when rejecting an application';
  end if;

  if p_approved then
    insert into public.organizations(name, kind, is_active)
    values (application.organization_name, 'supplier', true)
    returning id into new_organization_id;

    insert into public.organization_memberships(organization_id, user_id, role, is_active)
    values (new_organization_id, application.applicant_user_id, 'manager', true);

    update public.supplier_applications
    set status = 'approved',
        review_note = nullif(btrim(p_note), ''),
        reviewed_by = (select auth.uid()),
        reviewed_at = statement_timestamp(),
        organization_id = new_organization_id,
        updated_at = statement_timestamp()
    where id = p_application_id;
    return new_organization_id;
  end if;

  update public.supplier_applications
  set status = 'rejected',
      review_note = btrim(p_note),
      reviewed_by = (select auth.uid()),
      reviewed_at = statement_timestamp(),
      organization_id = null,
      updated_at = statement_timestamp()
  where id = p_application_id;
  return null;
end;
$$;

revoke execute on function public.review_supplier_application(uuid, boolean, text) from public, anon;
grant execute on function public.review_supplier_application(uuid, boolean, text) to authenticated;

create function public.review_supplier_offer(
  p_offer_id uuid,
  p_approved boolean,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_catalog_admin() then
    raise exception 'Administrator access required';
  end if;
  if not p_approved and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'A short reason is required when rejecting an offer';
  end if;

  update public.supplier_offers
  set status = case when p_approved then 'published' else 'rejected' end,
      published_at = case when p_approved then statement_timestamp() else null end,
      verified_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_offer_id
    and status = 'pending_review'
    and exists (
      select 1 from public.organizations org
      where org.id = supplier_offers.supplier_organization_id
        and org.kind = 'supplier' and org.is_active
    );

  if not found then
    raise exception 'Supplier offer is no longer pending or its supplier is inactive';
  end if;

  insert into public.supplier_offer_reviews(offer_id, decision, review_note, reviewed_by)
  values (
    p_offer_id,
    case when p_approved then 'published' else 'rejected' end,
    nullif(btrim(p_note), ''),
    (select auth.uid())
  );
end;
$$;

revoke execute on function public.review_supplier_offer(uuid, boolean, text) from public, anon;
grant execute on function public.review_supplier_offer(uuid, boolean, text) to authenticated;

grant execute on function private.is_active_supplier_member(uuid) to authenticated;
grant usage on schema private to authenticated;
