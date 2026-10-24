-- Check pilot: raw sources, reviewed catalogue, subscriptions and isolated dossiers.
-- No commercial prices, access rights or catalogue publications are seeded here.

do $$
begin
  if exists (select 1 from pg_tables where schemaname in ('public', 'private')) then
    raise exception 'Initial Check migration requires empty public/private application schemas';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 200),
  avatar_url text check (avatar_url is null or avatar_url like 'https://%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kind text not null default 'insurer' check (kind in ('insurer', 'business', 'supplier', 'delivery')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table private.staff_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'catalog_admin', 'billing_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 300),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create table public.units (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  label text not null,
  dimension text not null check (dimension in ('count', 'volume', 'mass', 'package'))
);

create table public.reference_sources (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  edition text not null,
  sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  page_count integer not null check (page_count > 0),
  received_on date not null,
  provenance text not null,
  download_origin_verified boolean not null default false,
  valid_from date,
  valid_until date,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table public.source_groups (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.reference_sources(id) on delete restrict,
  external_id text not null,
  ordinal integer not null check (ordinal > 0),
  label_raw text not null,
  chapter_label_raw text not null,
  declared_items integer not null check (declared_items >= 0),
  first_pdf_page integer not null check (first_pdf_page > 0),
  last_pdf_page integer not null,
  printed_start integer,
  category_id uuid references public.categories(id) on delete restrict,
  unique (source_id, external_id),
  unique (id, source_id),
  check (last_pdf_page >= first_pdf_page)
);

create table public.source_families (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.reference_sources(id) on delete restrict,
  source_group_id uuid not null,
  external_id text not null,
  ordinal_raw text not null,
  code_raw text,
  label text not null,
  label_variants jsonb not null default '[]'::jsonb check (jsonb_typeof(label_variants) = 'array'),
  source_pages jsonb not null check (jsonb_typeof(source_pages) = 'array'),
  category_id uuid references public.categories(id) on delete restrict,
  mapping_status text not null default 'pending' check (mapping_status in ('pending', 'approved')),
  mapped_by uuid references public.profiles(id) on delete set null,
  mapped_at timestamptz,
  mapping_note text,
  unique (source_id, external_id),
  unique (id, source_id),
  foreign key (source_group_id, source_id) references public.source_groups(id, source_id),
  check (mapping_status <> 'approved' or (category_id is not null and mapped_at is not null))
);

create table public.reference_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.reference_sources(id) on delete restrict,
  source_family_id uuid not null,
  external_id text not null,
  source_item_number text not null,
  designation text not null check (btrim(designation) <> ''),
  unit_raw text not null,
  unit_code text not null references public.units(code),
  kind text not null check (kind in ('product', 'service_candidate')),
  pm numeric(20,4),
  li numeric(20,4),
  ls numeric(20,4),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_basis text not null check (tax_basis in ('HT', 'TTC', 'unknown')),
  pdf_page integer not null check (pdf_page > 0),
  printed_page integer,
  table_index integer not null check (table_index > 0),
  row_index integer not null check (row_index > 0),
  source_location jsonb not null check (jsonb_typeof(source_location) = 'object'),
  raw_cells jsonb not null check (jsonb_typeof(raw_cells) = 'object'),
  source_payload jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  review_status text not null default 'ready_for_review'
    check (review_status in ('ready_for_review', 'needs_review', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  category_id uuid references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  unique (source_id, pdf_page, table_index, row_index),
  unique (id, source_id),
  foreign key (source_family_id, source_id) references public.source_families(id, source_id),
  check (review_status <> 'approved' or reviewed_at is not null)
);

create table public.reference_entry_issues (
  id uuid primary key default gen_random_uuid(),
  reference_entry_id uuid not null references public.reference_entries(id) on delete restrict,
  code text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reference_entry_id, code),
  check (status = 'open' or (nullif(btrim(resolution_note), '') is not null and resolved_at is not null))
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  unit_code text not null references public.units(code),
  name text not null check (char_length(btrim(name)) between 1 and 500),
  brand text,
  manufacturer_reference text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  fitment_verified boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', coalesce(name, '') || ' ' || coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(manufacturer_reference, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, unit_code)
);
create index products_search_idx on public.products using gin(search_vector);

create table public.reference_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  unit_code text not null references public.units(code),
  source_id uuid not null references public.reference_sources(id) on delete restrict,
  reference_entry_id uuid not null,
  revision integer not null default 1 check (revision > 0),
  pm numeric(20,4) not null,
  li numeric(20,4) not null,
  ls numeric(20,4) not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_basis text not null check (tax_basis in ('HT', 'TTC', 'unknown')),
  matching_verified boolean not null default false,
  correction_note text,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, unit_code) references public.products(id, unit_code),
  foreign key (reference_entry_id, source_id) references public.reference_entries(id, source_id),
  unique (reference_entry_id, product_id, revision),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (status <> 'published' or (li > 0 and li <= pm and pm <= ls
    and tax_basis <> 'unknown' and matching_verified and published_at is not null))
);
create unique index reference_prices_one_publication_idx on public.reference_prices(product_id, source_id)
  where status = 'published';

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  audience text not null check (audience in ('personal', 'organization')),
  billing_basis text check (billing_basis in ('per_user', 'per_organization')),
  amount numeric(18,2),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  duration_days integer check (duration_days > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount > 0),
  check (audience <> 'personal' or billing_basis is null or billing_basis = 'per_user'),
  check (not is_active or (amount is not null and duration_days is not null and billing_basis is not null))
);

-- A subscription row represents one access period. A renewal creates a new period.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  billing_basis text not null check (billing_basis in ('per_user', 'per_organization')),
  seat_limit integer check (seat_limit > 0),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked', 'cancelled')),
  period_start timestamptz,
  period_end timestamptz,
  activation_payment_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (num_nonnulls(user_id, organization_id) = 1),
  check (user_id is null or billing_basis = 'per_user'),
  check (organization_id is null or billing_basis <> 'per_user' or seat_limit is not null),
  check (period_end is null or period_start is null or period_end > period_start),
  check (status <> 'active' or (activation_payment_id is not null and period_start is not null and period_end is not null))
);
create index subscriptions_active_user_idx on public.subscriptions(user_id, period_end) where status = 'active';
create index subscriptions_active_org_idx on public.subscriptions(organization_id, period_end) where status = 'active';

create table public.subscription_seats (
  subscription_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, user_id),
  foreign key (subscription_id, organization_id) references public.subscriptions(id, organization_id) on delete cascade,
  foreign key (organization_id, user_id) references public.organization_memberships(organization_id, user_id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (btrim(provider) <> ''),
  provider_payment_id text,
  method text not null check (method in ('mobile_money', 'card', 'store_billing')),
  idempotency_key text not null unique,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id),
  check (status <> 'succeeded' or (verified_at is not null and provider_payment_id is not null))
);
alter table public.subscriptions add constraint subscriptions_activation_payment_id_fkey
  foreign key (activation_payment_id) references public.payments(id) on delete restrict;

create table private.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  payment_id uuid references public.payments(id) on delete restrict,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  verified_at timestamptz,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id),
  check (processed_at is null or verified_at is not null)
);

create table public.quote_dossiers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(owner_user_id, organization_id) = 1)
);
create index quote_dossiers_owner_recent_idx on public.quote_dossiers(owner_user_id, created_at desc);
create index quote_dossiers_org_author_idx on public.quote_dossiers(organization_id, created_by, created_at desc);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.quote_dossiers(id) on delete cascade,
  position integer not null check (position > 0),
  designation text not null check (char_length(btrim(designation)) between 1 and 1000),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_code text references public.units(code),
  unit_price numeric(20,4) not null check (unit_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_basis text not null check (tax_basis in ('HT', 'TTC', 'unknown')),
  tax_rate numeric(7,4) check (tax_rate >= 0 and tax_rate <= 100),
  selected_product_id uuid references public.products(id) on delete restrict,
  matching_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dossier_id, position)
);

create table public.comparison_runs (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.quote_dossiers(id) on delete cascade,
  performed_by uuid references public.profiles(id) on delete set null,
  algorithm_version text not null,
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default now()
);
create index comparison_runs_dossier_recent_idx on public.comparison_runs(dossier_id, created_at desc);

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.reference_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reference_price_id uuid references public.reference_prices(id) on delete restrict,
  comparison_run_id uuid references public.comparison_runs(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 3000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(reference_price_id, comparison_run_id) > 0)
);

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  database_role text not null,
  table_name text not null,
  operation text not null,
  row_id text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create table private.reference_imports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.reference_sources(id) on delete restrict,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  expected_groups integer not null,
  expected_families integer not null,
  expected_entries integer not null,
  expected_issues integer not null,
  quality_report jsonb not null check (jsonb_typeof(quality_report) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Helpers are in an unexposed schema, read current database memberships and
-- always bind authorization decisions to the calling auth.uid().
create function private.is_catalog_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.staff_members s where s.user_id = auth.uid()
      and s.is_active and s.role in ('owner', 'catalog_admin')
  );
$$;

create function private.is_billing_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.staff_members s where s.user_id = auth.uid()
      and s.is_active and s.role in ('owner', 'billing_admin')
  );
$$;

create function private.is_org_member(organization uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = organization and m.user_id = auth.uid() and m.is_active and o.is_active
  );
$$;

create function private.is_org_manager(organization uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = organization and m.user_id = auth.uid()
      and m.role = 'manager' and m.is_active and o.is_active
  );
$$;

create function private.has_catalog_access(organization uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.subscriptions s
    join public.payments p on p.id = s.activation_payment_id and p.subscription_id = s.id
    where s.status = 'active' and s.period_start <= statement_timestamp() and s.period_end > statement_timestamp()
      and p.status = 'succeeded' and p.verified_at is not null and p.amount = s.amount and p.currency = s.currency
      and (
        (organization is null and s.organization_id is null and s.user_id = auth.uid())
        or
        (organization is not null and s.organization_id = organization
          and private.is_org_member(organization)
          and (s.billing_basis = 'per_organization' or exists (
            select 1 from public.subscription_seats seat
            where seat.subscription_id = s.id and seat.user_id = auth.uid()
          )))
      )
  );
$$;

create function private.has_any_catalog_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    private.has_catalog_access(null) or exists (
      select 1 from public.organization_memberships m
      where m.user_id = auth.uid() and m.is_active and private.has_catalog_access(m.organization_id)
    )
  );
$$;

create function private.entry_is_approved(entry_id uuid, product_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.reference_entries e
    join public.source_families f on f.id = e.source_family_id
    join public.categories c on c.id = coalesce(e.category_id, f.category_id)
    join public.products p on p.id = product_id and p.category_id = c.id and p.unit_code = e.unit_code
    where e.id = entry_id and e.review_status = 'approved' and c.is_active
      and (e.category_id is not null or f.mapping_status = 'approved')
      and not exists (select 1 from public.reference_entry_issues i where i.reference_entry_id = e.id and i.status = 'open')
  );
$$;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- User metadata is used only as an editable display name, never as a role.
  insert into public.profiles(id, display_name)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 200))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger check_create_profile after insert on auth.users
for each row execute function private.handle_new_user();
insert into public.profiles(id, display_name)
select id, left(raw_user_meta_data ->> 'display_name', 200) from auth.users
on conflict (id) do nothing;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.guard_source_fields() returns trigger
language plpgsql set search_path = '' as $$
declare field_name text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Source evidence must be retained; use review or retirement states';
  end if;
  foreach field_name in array tg_argv loop
    if (to_jsonb(new) -> field_name) is distinct from (to_jsonb(old) -> field_name) then
      raise exception 'Immutable source field: %', field_name;
    end if;
  end loop;
  return new;
end;
$$;
create trigger reference_sources_preserve before update or delete on public.reference_sources
for each row execute function private.guard_source_fields('external_id', 'edition', 'sha256', 'byte_size', 'page_count', 'manifest');
create trigger source_groups_preserve before update or delete on public.source_groups
for each row execute function private.guard_source_fields('source_id', 'external_id', 'ordinal', 'label_raw', 'chapter_label_raw', 'declared_items', 'first_pdf_page', 'last_pdf_page', 'printed_start');
create trigger source_families_preserve before update or delete on public.source_families
for each row execute function private.guard_source_fields('source_id', 'source_group_id', 'external_id', 'ordinal_raw', 'code_raw', 'label', 'label_variants', 'source_pages');
create trigger reference_entries_preserve before update or delete on public.reference_entries
for each row execute function private.guard_source_fields('source_id', 'source_family_id', 'external_id', 'source_item_number', 'designation', 'unit_raw', 'unit_code', 'kind', 'pm', 'li', 'ls', 'currency', 'tax_basis', 'pdf_page', 'printed_page', 'table_index', 'row_index', 'source_location', 'raw_cells', 'source_payload');
create trigger reference_issues_preserve before update or delete on public.reference_entry_issues
for each row execute function private.guard_source_fields('reference_entry_id', 'code', 'message');

create function private.guard_category_tree() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if exists (
      with recursive parents as (
        select id, parent_id from public.categories where id = new.parent_id
        union
        select c.id, c.parent_id from public.categories c join parents p on c.id = p.parent_id
      ) select 1 from parents where id = new.id
    ) then raise exception 'Category cycle is forbidden'; end if;
    if new.is_active and not exists (select 1 from public.categories where id = new.parent_id and is_active) then
      raise exception 'Activate the parent category first';
    end if;
  end if;
  return new;
end;
$$;
create trigger categories_tree_guard before insert or update on public.categories
for each row execute function private.guard_category_tree();

create function private.deactivate_child_categories() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.is_active and not new.is_active then
    update public.categories set is_active = false where parent_id = new.id and is_active;
  end if;
  return new;
end;
$$;
create trigger categories_deactivate_children after update of is_active on public.categories
for each row execute function private.deactivate_child_categories();

create function private.guard_reference_publication() returns trigger
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
    if entry.review_status <> 'approved' or exists (
      select 1 from public.reference_entry_issues where reference_entry_id = entry.id and status = 'open'
    ) then raise exception 'Review the source entry and resolve its issues first'; end if;
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
create trigger reference_prices_publication_guard before insert or update on public.reference_prices
for each row execute function private.guard_reference_publication();

create function private.guard_subscription_activation() returns trigger
language plpgsql set search_path = '' as $$
declare payment public.payments%rowtype; plan public.subscription_plans%rowtype;
begin
  if tg_op = 'UPDATE' and old.activation_payment_id is not null and
    row(new.plan_id, new.user_id, new.organization_id, new.billing_basis, new.seat_limit, new.amount, new.currency, new.period_start, new.period_end, new.activation_payment_id)
    is distinct from
    row(old.plan_id, old.user_id, old.organization_id, old.billing_basis, old.seat_limit, old.amount, old.currency, old.period_start, old.period_end, old.activation_payment_id) then
    raise exception 'An activated period is immutable; renew with a new period';
  end if;
  if new.status = 'active' then
    select * into strict payment from public.payments where id = new.activation_payment_id for share;
    if payment.subscription_id <> new.id or payment.status <> 'succeeded' or payment.verified_at is null
       or payment.amount <> new.amount or payment.currency <> new.currency then
      raise exception 'Activation requires the matching verified payment';
    end if;
    if tg_op = 'INSERT' or old.status <> 'active' then
      select * into strict plan from public.subscription_plans where id = new.plan_id;
      if not plan.is_active or plan.billing_basis is distinct from new.billing_basis
        or (new.user_id is not null and plan.audience <> 'personal')
        or (new.organization_id is not null and plan.audience <> 'organization') then
        raise exception 'Select an active compatible commercial plan first';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger subscriptions_activation_guard before insert or update on public.subscriptions
for each row execute function private.guard_subscription_activation();

create function private.guard_subscription_seat_count() returns trigger
language plpgsql set search_path = '' as $$
declare allowed integer; occupied integer;
begin
  select seat_limit into allowed from public.subscriptions where id = new.subscription_id for update;
  if allowed is not null then
    select count(*) into occupied from public.subscription_seats
    where subscription_id = new.subscription_id and user_id <> new.user_id;
    if occupied >= allowed then raise exception 'Subscription seat limit reached'; end if;
  end if;
  return new;
end;
$$;
create trigger subscription_seats_count_guard before insert or update on public.subscription_seats
for each row execute function private.guard_subscription_seat_count();

create function private.reject_snapshot_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Comparison snapshots are immutable; create a new comparison run';
end;
$$;
create trigger comparison_runs_immutable before update on public.comparison_runs
for each row execute function private.reject_snapshot_update();

alter table public.reference_entries add check (
  (pm is null or pm < 'Infinity'::numeric) and (li is null or li < 'Infinity'::numeric)
  and (ls is null or ls < 'Infinity'::numeric)
);
alter table public.reference_prices add check (pm < 'Infinity'::numeric and li < 'Infinity'::numeric and ls < 'Infinity'::numeric);
alter table public.subscription_plans add check (amount is null or amount < 'Infinity'::numeric);
alter table public.subscriptions add check (amount < 'Infinity'::numeric);
alter table public.payments add check (amount < 'Infinity'::numeric);
alter table public.quote_lines add check (quantity < 'Infinity'::numeric and unit_price < 'Infinity'::numeric and (tax_rate is null or tax_rate < 'Infinity'::numeric));

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_data jsonb; after_data jsonb;
begin
  if tg_op <> 'INSERT' then before_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_data := to_jsonb(new); end if;
  insert into private.audit_events(actor_user_id, database_role, table_name, operation, row_id, before_value, after_value)
  values (auth.uid(), coalesce(nullif(current_setting('role', true), 'none'), session_user),
    tg_table_schema || '.' || tg_table_name, tg_op,
    coalesce(after_data ->> 'id', before_data ->> 'id', after_data ->> 'user_id', before_data ->> 'user_id'),
    before_data, after_data);
  return coalesce(new, old);
end;
$$;

-- Live authorization checks use the current memberships and payment state,
-- while expired users can still read their existing dossier snapshots.
do $$
declare relation record;
begin
  for relation in select schemaname, tablename from pg_tables where schemaname in ('public', 'private') loop
    execute format('alter table %I.%I enable row level security', relation.schemaname, relation.tablename);
    execute format('revoke all on table %I.%I from public, anon, authenticated', relation.schemaname, relation.tablename);
    execute format('grant select, insert, update, delete on table %I.%I to service_role', relation.schemaname, relation.tablename);
  end loop;
  for relation in select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at' loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', relation.table_name);
  end loop;
end;
$$;

grant select on public.categories, public.units, public.subscription_plans to anon, authenticated;
create policy categories_visible on public.categories for select to anon
  using (is_active);
create policy units_visible on public.units for select to anon, authenticated using (true);
create policy subscription_plans_visible on public.subscription_plans for select to anon
  using (is_active);

grant select on public.profiles, public.organizations, public.organization_memberships,
  public.reference_sources, public.source_groups, public.source_families, public.reference_entries,
  public.reference_entry_issues, public.products, public.reference_prices,
  public.subscriptions, public.subscription_seats, public.payments, public.quote_dossiers,
  public.quote_lines, public.comparison_runs, public.favorites, public.reference_reports to authenticated;

create policy profiles_own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
grant update (display_name, avatar_url) on public.profiles to authenticated;
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy organizations_member_select on public.organizations for select to authenticated
  using ((select private.is_org_member(id)));
create policy memberships_scoped_select on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_org_manager(organization_id)));

create policy sources_subscriber_select on public.reference_sources for select to authenticated
  using ((select private.is_catalog_admin()) or (select private.has_any_catalog_access()));
create policy source_groups_admin_select on public.source_groups for select to authenticated using ((select private.is_catalog_admin()));
create policy source_families_admin_select on public.source_families for select to authenticated using ((select private.is_catalog_admin()));
create policy entries_admin_select on public.reference_entries for select to authenticated using ((select private.is_catalog_admin()));
create policy entry_issues_admin_select on public.reference_entry_issues for select to authenticated using ((select private.is_catalog_admin()));
create policy categories_authenticated_select on public.categories for select to authenticated using (is_active or (select private.is_catalog_admin()));
create policy plans_authenticated_select on public.subscription_plans for select to authenticated using (is_active or (select private.is_billing_admin()));
create policy products_authorized_select on public.products for select to authenticated using (
  (select private.is_catalog_admin()) or (
    status = 'published' and (select private.has_any_catalog_access())
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  )
);
create policy prices_authorized_select on public.reference_prices for select to authenticated using (
  (select private.is_catalog_admin()) or (
    status = 'published' and (select private.has_any_catalog_access())
    and (select private.entry_is_approved(reference_entry_id, product_id))
    and (valid_from is null or valid_from <= current_date) and (valid_until is null or valid_until >= current_date)
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
  )
);
create policy subscriptions_scoped_select on public.subscriptions for select to authenticated using (
  user_id = (select auth.uid()) or (select private.is_org_manager(organization_id))
  or ((select private.is_org_member(organization_id)) and exists (
    select 1 from public.subscription_seats seat where seat.subscription_id = id and seat.user_id = (select auth.uid())
  ))
  or (select private.is_billing_admin())
);
create policy seats_scoped_select on public.subscription_seats for select to authenticated using (
  (user_id = (select auth.uid()) and (select private.is_org_member(organization_id)))
  or (select private.is_org_manager(organization_id))
);
create policy payments_scoped_select on public.payments for select to authenticated using (
  (select private.is_billing_admin()) or exists (
    select 1 from public.subscriptions s where s.id = subscription_id
      and (s.user_id = (select auth.uid()) or private.is_org_manager(s.organization_id))
  )
);

create policy dossiers_scoped_select on public.quote_dossiers for select to authenticated using (
  owner_user_id = (select auth.uid()) or (
    (select private.is_org_member(organization_id))
    and (created_by = (select auth.uid()) or (select private.is_org_manager(organization_id)))
  )
);
grant insert (id, owner_user_id, organization_id, title) on public.quote_dossiers to authenticated;
create policy dossiers_paid_insert on public.quote_dossiers for insert to authenticated with check (
  created_by = (select auth.uid()) and (select private.has_catalog_access(organization_id))
  and (owner_user_id = (select auth.uid()) or (organization_id is not null and (select private.is_org_member(organization_id))))
);
grant update (title, archived_at) on public.quote_dossiers to authenticated;
create policy dossiers_scoped_update on public.quote_dossiers for update to authenticated using (
  owner_user_id = (select auth.uid()) or (
    (select private.is_org_member(organization_id))
    and (created_by = (select auth.uid()) or (select private.is_org_manager(organization_id)))
  )
) with check (
  owner_user_id = (select auth.uid()) or (
    (select private.is_org_member(organization_id))
    and (created_by = (select auth.uid()) or (select private.is_org_manager(organization_id)))
  )
);
grant delete on public.quote_dossiers to authenticated;
create policy dossiers_personal_delete on public.quote_dossiers for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy quote_lines_scoped_select on public.quote_lines for select to authenticated
  using (exists (select 1 from public.quote_dossiers d where d.id = dossier_id));
grant insert (id, dossier_id, position, designation, quantity, unit_code, unit_price, currency, tax_basis, tax_rate, selected_product_id, matching_note)
  on public.quote_lines to authenticated;
grant update (position, designation, quantity, unit_code, unit_price, currency, tax_basis, tax_rate, selected_product_id, matching_note)
  on public.quote_lines to authenticated;
grant delete on public.quote_lines to authenticated;
create policy quote_lines_paid_insert on public.quote_lines for insert to authenticated with check (
  exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null and private.has_catalog_access(d.organization_id))
  and (selected_product_id is null or exists (select 1 from public.products p where p.id = selected_product_id and p.status = 'published'))
);
create policy quote_lines_paid_update on public.quote_lines for update to authenticated using (
  exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null and private.has_catalog_access(d.organization_id))
) with check (
  exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null and private.has_catalog_access(d.organization_id))
  and (selected_product_id is null or exists (select 1 from public.products p where p.id = selected_product_id and p.status = 'published'))
);
create policy quote_lines_paid_delete on public.quote_lines for delete to authenticated using (
  exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null and private.has_catalog_access(d.organization_id))
);
create policy comparison_runs_scoped_select on public.comparison_runs for select to authenticated
  using (exists (select 1 from public.quote_dossiers d where d.id = dossier_id));

create policy favorites_own_select on public.favorites for select to authenticated using (user_id = (select auth.uid()));
grant insert (product_id) on public.favorites to authenticated;
create policy favorites_paid_insert on public.favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and (select private.has_any_catalog_access())
  and exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
);
grant delete on public.favorites to authenticated;
create policy favorites_own_delete on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy reports_scoped_select on public.reference_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_catalog_admin()));
grant insert (reference_price_id, comparison_run_id, message) on public.reference_reports to authenticated;
create policy reports_owned_insert on public.reference_reports for insert to authenticated with check (
  user_id = (select auth.uid())
  and (reference_price_id is null or exists (select 1 from public.reference_prices p where p.id = reference_price_id))
  and (comparison_run_id is null or exists (select 1 from public.comparison_runs r where r.id = comparison_run_id))
);

-- Lock down implicit EXECUTE grants, including privileged trigger functions.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_catalog_admin(), private.is_billing_admin(), private.is_org_member(uuid),
  private.is_org_manager(uuid), private.has_catalog_access(uuid), private.has_any_catalog_access(),
  private.entry_is_approved(uuid, uuid) to authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
grant usage, select on all sequences in schema private to service_role;
revoke insert, update, delete on private.audit_events from service_role;

do $$
declare name text;
begin
  foreach name in array array['organizations', 'organization_memberships', 'categories', 'products',
    'reference_prices', 'subscription_plans', 'subscriptions', 'subscription_seats', 'payments'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()', name);
  end loop;
  foreach name in array array['reference_sources', 'source_groups', 'source_families', 'reference_entries', 'reference_entry_issues'] loop
    execute format('create trigger audit_change after update or delete on public.%I for each row execute function private.audit_change()', name);
  end loop;
end;
$$;
create trigger staff_audit after insert or update or delete on private.staff_members
for each row execute function private.audit_change();

-- Cover each FK with a leading-column index, reusing existing PK/unique indexes.
do $$
declare fk record; columns_sql text;
begin
  for fk in
    select c.conrelid, c.conname, c.conkey, n.nspname, t.relname
    from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname in ('public', 'private')
  loop
    if not exists (
      select 1 from pg_index i where i.indrelid = fk.conrelid and i.indisvalid and i.indpred is null
        and (i.indkey::smallint[])[0:cardinality(fk.conkey)-1] = fk.conkey
    ) then
      select string_agg(quote_ident(a.attname), ', ' order by k.ordinality) into columns_sql
      from unnest(fk.conkey) with ordinality k(attnum, ordinality)
      join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = k.attnum;
      execute format('create index %I on %I.%I (%s)',
        left(fk.relname, 30) || '_fk_' || substr(md5(fk.conname), 1, 10), fk.nspname, fk.relname, columns_sql);
    end if;
  end loop;
end;
$$;

comment on table public.reference_entries is 'Immutable extracted source facts; review metadata is editable only by the backend.';
comment on table public.reference_prices is 'Reviewed, versioned references; publication and a paid entitlement are required for customer reads.';
comment on table public.comparison_runs is 'Server-produced immutable historical snapshots; dossier ownership remains authoritative after subscription expiry.';
comment on table public.subscriptions is 'One verified payment activates one immutable access period; pricing is still to be defined.';
