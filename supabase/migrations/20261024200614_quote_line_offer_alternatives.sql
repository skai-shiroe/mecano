create table public.quote_line_offer_alternatives (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.quote_dossiers(id) on delete cascade,
  quote_line_id uuid not null references public.quote_lines(id) on delete cascade,
  supplier_offer_id uuid references public.supplier_offers(id) on delete set null,
  supplier_organization_id uuid references public.organizations(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  supplier_name text not null check (char_length(btrim(supplier_name)) between 1 and 200),
  product_name text not null check (char_length(btrim(product_name)) between 1 and 300),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price > 0),
  delivery_fee numeric(14,2) not null check (delivery_fee >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_basis text not null check (tax_basis in ('HT', 'TTC', 'unknown')),
  condition text not null check (condition in ('new', 'reconditioned', 'used')),
  quality text not null check (quality in ('original', 'equivalent', 'reconditioned', 'used')),
  delivery_zone text not null check (char_length(btrim(delivery_zone)) between 2 and 200),
  delivery_days_min integer check (delivery_days_min is null or delivery_days_min >= 0),
  delivery_days_max integer check (delivery_days_max is null or delivery_days_max >= 0),
  offer_verified_at timestamptz not null,
  valid_until date,
  stock_quantity numeric(14,3) check (stock_quantity is null or stock_quantity >= 0),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_line_id, supplier_offer_id),
  check (delivery_days_min is null or delivery_days_max is null or delivery_days_max >= delivery_days_min)
);

create index quote_line_offer_alternatives_dossier_idx
  on public.quote_line_offer_alternatives(dossier_id, quote_line_id, created_at desc);

alter table public.quote_line_offer_alternatives enable row level security;
revoke all on public.quote_line_offer_alternatives from public, anon, authenticated;
grant select on public.quote_line_offer_alternatives to authenticated;
create policy quote_line_offer_alternatives_scoped_select
  on public.quote_line_offer_alternatives for select to authenticated
  using (private.can_access_insurer_dossier(dossier_id));

alter table public.quote_dossier_events
  drop constraint quote_dossier_events_event_type_check;
alter table public.quote_dossier_events
  add constraint quote_dossier_events_event_type_check check (event_type in (
    'created', 'quote_added', 'quote_updated', 'quote_removed',
    'assignment_changed', 'comparison_saved', 'decision_recorded',
    'status_changed', 'archived', 'supplier_offer_added'
  ));

create function private.add_insurer_offer_alternative(
  p_quote_line_id uuid,
  p_supplier_offer_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  quote_line public.quote_lines%rowtype;
  dossier public.quote_dossiers%rowtype;
  supplier_offer public.supplier_offers%rowtype;
  supplier_name text;
  product_name text;
  is_currently_above boolean;
  alternative_id uuid;
begin
  if actor is null then raise exception 'Connexion requise'; end if;

  select * into quote_line
  from public.quote_lines ql
  where ql.id = p_quote_line_id
  for update;
  if not found or quote_line.quote_estimate_id is null or quote_line.selected_product_id is null then
    raise exception 'La ligne de devis ou son produit associé est introuvable';
  end if;

  select * into dossier
  from public.quote_dossiers d
  where d.id = quote_line.dossier_id
  for update;
  if not found or dossier.archived_at is not null or dossier.workflow_status <> 'compared'
     or not private.can_access_insurer_dossier(dossier.id) then
    raise exception 'Relance la comparaison ou vérifie tes droits sur ce dossier';
  end if;

  select exists (
    select 1
    from (
      select cr.result_snapshot
      from public.comparison_runs cr
      where cr.dossier_id = dossier.id
      order by cr.created_at desc
      limit 1
    ) latest
    cross join lateral jsonb_array_elements(coalesce(latest.result_snapshot -> 'lines', '[]'::jsonb)) compared_line
    where compared_line ->> 'line_id' = quote_line.id::text
      and compared_line ->> 'status' = 'above'
      and compared_line ->> 'selected_product_id' = quote_line.selected_product_id::text
      and (compared_line ->> 'quantity')::numeric = quote_line.quantity
      and (compared_line ->> 'line_total')::numeric = quote_line.quantity * quote_line.unit_price
      and compared_line ->> 'currency' = quote_line.currency
      and compared_line ->> 'tax_basis' = quote_line.tax_basis
  ) into is_currently_above;

  if not is_currently_above then
    raise exception 'Cette ligne n’est plus au-dessus de la référence dans la dernière comparaison';
  end if;

  select * into supplier_offer
  from public.supplier_offers so
  where so.id = p_supplier_offer_id
    and so.status = 'published'
    and so.condition = 'new'
    and so.quality = 'original'
    and so.availability = 'available'
    and (so.valid_until is null or so.valid_until >= current_date)
    and so.currency = so.delivery_currency
  for share;
  if not found then raise exception 'Cette offre n’est plus disponible'; end if;

  if supplier_offer.product_id is distinct from quote_line.selected_product_id
     or supplier_offer.currency is distinct from quote_line.currency
     or supplier_offer.tax_basis is distinct from quote_line.tax_basis
     or (supplier_offer.stock_quantity is not null and supplier_offer.stock_quantity < quote_line.quantity)
     or supplier_offer.unit_price * quote_line.quantity + supplier_offer.delivery_fee >= quote_line.unit_price * quote_line.quantity then
    raise exception 'Cette offre ne correspond plus à la ligne ou son prix livré n’est plus inférieur';
  end if;

  select o.name into supplier_name
  from public.organizations o
  where o.id = supplier_offer.supplier_organization_id
    and o.kind = 'supplier' and o.is_active;
  if not found then raise exception 'Le fournisseur n’est plus actif'; end if;

  select p.name into product_name
  from public.products p
  where p.id = supplier_offer.product_id and p.status = 'published';
  if not found then raise exception 'Le produit de cette offre n’est plus publié'; end if;

  insert into public.quote_line_offer_alternatives (
    dossier_id, quote_line_id, supplier_offer_id, supplier_organization_id, product_id,
    supplier_name, product_name, quantity, unit_price, delivery_fee, currency, tax_basis,
    condition, quality, delivery_zone, delivery_days_min, delivery_days_max,
    offer_verified_at, valid_until, stock_quantity, added_by
  ) values (
    dossier.id, quote_line.id, supplier_offer.id, supplier_offer.supplier_organization_id,
    supplier_offer.product_id, supplier_name, product_name, quote_line.quantity,
    supplier_offer.unit_price, supplier_offer.delivery_fee, supplier_offer.currency,
    supplier_offer.tax_basis, supplier_offer.condition, supplier_offer.quality,
    supplier_offer.delivery_zone, supplier_offer.delivery_days_min, supplier_offer.delivery_days_max,
    supplier_offer.verified_at, supplier_offer.valid_until, supplier_offer.stock_quantity, actor
  )
  on conflict (quote_line_id, supplier_offer_id) do nothing
  returning id into alternative_id;

  if alternative_id is null then
    select a.id into alternative_id
    from public.quote_line_offer_alternatives a
    where a.quote_line_id = quote_line.id and a.supplier_offer_id = supplier_offer.id;
  else
    insert into public.quote_dossier_events(dossier_id, actor_user_id, event_type, summary, details)
    values (
      dossier.id, actor, 'supplier_offer_added',
      left('Offre fournisseur ajoutée · ' || supplier_name || ' · ' || quote_line.designation, 300),
      jsonb_build_object(
        'alternative_id', alternative_id,
        'quote_line_id', quote_line.id,
        'supplier_offer_id', supplier_offer.id,
        'delivered_total', supplier_offer.unit_price * quote_line.quantity + supplier_offer.delivery_fee,
        'currency', supplier_offer.currency
      )
    );
  end if;

  return alternative_id;
end;
$$;

create function public.add_insurer_offer_alternative(
  p_quote_line_id uuid,
  p_supplier_offer_id uuid
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.add_insurer_offer_alternative(p_quote_line_id, p_supplier_offer_id);
$$;

revoke all on function private.add_insurer_offer_alternative(uuid, uuid),
  public.add_insurer_offer_alternative(uuid, uuid) from public, anon;
revoke execute on function private.add_insurer_offer_alternative(uuid, uuid) from public, anon, authenticated;
grant execute on function private.add_insurer_offer_alternative(uuid, uuid) to authenticated;
grant execute on function public.add_insurer_offer_alternative(uuid, uuid) to authenticated;

comment on table public.quote_line_offer_alternatives is
  'Immutable supplier offer snapshots proposed for individual insurer quote lines; no order or payment is created.';
comment on function public.add_insurer_offer_alternative(uuid, uuid) is
  'Adds a currently published, lower delivered-price supplier offer to an accessible, current insurer dossier comparison.';
