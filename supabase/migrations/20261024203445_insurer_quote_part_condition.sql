-- Store optional part-state requirements on insurer quote lines.
-- Null means the insurer did not specify a state or quality; all clearly labeled offers remain eligible.
alter table public.quote_lines
  add column condition text,
  add column quality text,
  add constraint quote_lines_condition_check
    check (condition is null or condition in ('new', 'reconditioned', 'used')),
  add constraint quote_lines_quality_check
    check (quality is null or quality in ('original', 'equivalent', 'reconditioned', 'used'));

create or replace function private.save_insurer_estimate(
  p_estimate_id uuid,
  p_supplier_name text,
  p_quote_reference text,
  p_quote_date date,
  p_lines jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  dossier uuid;
  organization uuid;
begin
  if actor is null then raise exception 'Connexion requise'; end if;
  if nullif(btrim(p_supplier_name), '') is null or char_length(btrim(p_supplier_name)) > 200 then
    raise exception 'Indique un nom de concessionnaire de 1 à 200 caractères';
  end if;
  if p_quote_reference is not null and char_length(p_quote_reference) > 120 then
    raise exception 'La référence du devis est trop longue';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1
     or jsonb_array_length(p_lines) > 100 then
    raise exception 'Un devis doit contenir entre 1 et 100 lignes';
  end if;

  select qe.dossier_id, d.organization_id into dossier, organization
  from public.quote_estimates qe
  join public.quote_dossiers d on d.id = qe.dossier_id
  where qe.id = p_estimate_id and d.archived_at is null;

  if not found or organization is null or not private.can_access_insurer_dossier(dossier)
     or not private.has_insurer_workspace_access(organization) then
    raise exception 'Accès refusé à ce devis';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(
      position integer, designation text, quantity numeric, unit_code text,
      unit_price numeric, currency text, tax_basis text, condition text, quality text,
      tax_rate numeric, selected_product_id uuid, matching_note text
    )
    where line.position is null or line.position < 1
      or nullif(btrim(line.designation), '') is null
      or char_length(line.designation) > 1000
      or line.quantity is null or line.quantity <= 0 or line.quantity >= 'Infinity'::numeric
      or line.unit_price is null or line.unit_price < 0 or line.unit_price >= 'Infinity'::numeric
      or line.currency is null or line.currency !~ '^[A-Z]{3}$'
      or line.tax_basis is null or line.tax_basis not in ('HT', 'TTC', 'unknown')
      or (line.condition is not null and line.condition not in ('new', 'reconditioned', 'used'))
      or (line.quality is not null and line.quality not in ('original', 'equivalent', 'reconditioned', 'used'))
      or (line.tax_rate is not null and (line.tax_rate < 0 or line.tax_rate > 100))
      or (line.matching_note is not null and char_length(line.matching_note) > 1000)
  ) then
    raise exception 'Une ligne contient une quantité, un prix ou une unité invalide';
  end if;

  if (
    select count(*) <> count(distinct line.position)
    from jsonb_to_recordset(p_lines) as line(position integer)
  ) then
    raise exception 'Chaque ligne doit avoir un numéro de position unique';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(
      position integer, unit_code text, selected_product_id uuid
    )
    left join public.products p on p.id = line.selected_product_id
    where line.selected_product_id is not null
      and (p.id is null or p.status <> 'published' or p.unit_code is distinct from line.unit_code)
  ) then
    raise exception 'La référence choisie est indisponible ou son unité ne correspond pas';
  end if;

  update public.quote_estimates
  set supplier_name = btrim(p_supplier_name),
      quote_reference = nullif(btrim(p_quote_reference), ''),
      quote_date = p_quote_date
  where id = p_estimate_id;

  delete from public.quote_lines where quote_estimate_id = p_estimate_id;

  insert into public.quote_lines(
    dossier_id, quote_estimate_id, position, designation, quantity, unit_code,
    unit_price, currency, tax_basis, condition, quality, tax_rate, selected_product_id, matching_note
  )
  select
    dossier, p_estimate_id, line.position, btrim(line.designation), line.quantity,
    line.unit_code, line.unit_price, line.currency, line.tax_basis, line.condition, line.quality,
    line.tax_rate, line.selected_product_id, nullif(btrim(line.matching_note), '')
  from jsonb_to_recordset(p_lines) as line(
    position integer, designation text, quantity numeric, unit_code text,
    unit_price numeric, currency text, tax_basis text, condition text, quality text,
    tax_rate numeric, selected_product_id uuid, matching_note text
  )
  order by line.position;
end;
$$;

create or replace function private.compare_insurer_dossier(p_dossier_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  run_id uuid := gen_random_uuid();
  input_data jsonb;
  result_data jsonb;
  line_total integer;
begin
  if actor is null or not private.can_access_insurer_dossier(p_dossier_id) then
    raise exception 'Accès refusé à ce dossier';
  end if;

  if not exists (
    select 1 from public.quote_dossiers d
    where d.id = p_dossier_id and d.archived_at is null
      and private.has_insurer_workspace_access(d.organization_id)
  ) then
    raise exception 'Ce dossier ne peut pas être comparé';
  end if;

  with evaluated as (
    select
      qe.id as quote_id,
      qe.supplier_name,
      qe.quote_reference,
      qe.quote_date,
      ql.id as line_id,
      ql.position,
      ql.designation,
      ql.quantity,
      ql.unit_price,
      ql.tax_rate,
      ql.currency,
      ql.tax_basis,
      ql.condition,
      ql.quality,
      ql.unit_code,
      ql.selected_product_id,
      p.name as product_name,
      ref.price_id,
      ref.pm,
      ref.li,
      ref.ls,
      ref.reference_currency,
      ref.reference_tax_basis,
      ref.reference_unit_code,
      ref.source_title,
      ref.source_edition,
      ref.price_revision,
      case
        when ql.selected_product_id is null or ref.price_id is null then 'reference_unavailable'
        when ql.unit_code is null or ql.unit_code is distinct from ref.reference_unit_code then 'unit_mismatch'
        when ql.currency is distinct from ref.reference_currency then 'currency_mismatch'
        when ref.reference_tax_basis = 'unknown' or ql.tax_basis = 'unknown' then 'tax_basis_unknown'
        when ql.tax_basis is distinct from ref.reference_tax_basis then 'tax_basis_mismatch'
        when ref.li > ref.pm or ref.pm > ref.ls then 'reference_range_invalid'
        when ql.unit_price < ref.li then 'below'
        when ql.unit_price > ref.ls then 'above'
        else 'within'
      end as comparison_status
    from public.quote_estimates qe
    join public.quote_lines ql on ql.quote_estimate_id = qe.id and ql.dossier_id = qe.dossier_id
    left join public.products p on p.id = ql.selected_product_id
    left join lateral (
      select
        rp.id as price_id, rp.pm, rp.li, rp.ls, rp.currency as reference_currency,
        rp.tax_basis as reference_tax_basis, p2.unit_code as reference_unit_code,
        rs.title as source_title, rs.edition as source_edition, rp.revision as price_revision
      from public.reference_prices rp
      join public.products p2 on p2.id = rp.product_id
      join public.reference_sources rs on rs.id = rp.source_id
      where rp.product_id = ql.selected_product_id
        and rp.status = 'published' and rp.matching_verified
        and private.entry_is_approved(rp.reference_entry_id, rp.product_id)
        and (rp.valid_from is null or rp.valid_from <= current_date)
        and (rp.valid_until is null or rp.valid_until >= current_date)
      order by coalesce(rp.valid_from, rs.received_on) desc, rp.created_at desc
      limit 1
    ) ref on true
    where qe.dossier_id = p_dossier_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'quote_id', quote_id, 'supplier_name', supplier_name, 'quote_reference', quote_reference,
      'quote_date', quote_date, 'line_id', line_id, 'position', position,
      'designation', designation, 'quantity', quantity, 'unit_price', unit_price,
      'tax_rate', tax_rate, 'currency', currency, 'tax_basis', tax_basis,
      'condition', condition, 'quality', quality, 'unit_code', unit_code,
      'selected_product_id', selected_product_id, 'product_name', product_name
    ) order by supplier_name, quote_id, position), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'quote_id', quote_id, 'supplier_name', supplier_name, 'quote_reference', quote_reference,
      'quote_date', quote_date, 'line_id', line_id, 'position', position,
      'designation', designation, 'quantity', quantity, 'unit_price', unit_price,
      'tax_rate', tax_rate, 'line_total', quantity * unit_price, 'currency', currency, 'tax_basis', tax_basis,
      'condition', condition, 'quality', quality, 'unit_code', unit_code, 'selected_product_id', selected_product_id,
      'product_name', product_name, 'status', comparison_status,
      'delta', case
        when comparison_status = 'above' then unit_price - ls
        when comparison_status = 'below' then li - unit_price
        when comparison_status = 'within' then abs(unit_price - pm)
        else null
      end,
      'reference', case when price_id is null then null else jsonb_build_object(
        'price_id', price_id, 'pm', pm, 'li', li, 'ls', ls,
        'currency', reference_currency, 'tax_basis', reference_tax_basis,
        'unit_code', reference_unit_code, 'source_title', source_title,
        'source_edition', source_edition, 'revision', price_revision
      ) end
    ) order by supplier_name, quote_id, position), '[]'::jsonb),
    count(*)
  into input_data, result_data, line_total
  from evaluated;

  if line_total = 0 then
    raise exception 'Ajoute au moins un devis contenant une ligne avant de comparer';
  end if;

  insert into public.comparison_runs(
    id, dossier_id, performed_by, algorithm_version, input_snapshot, result_snapshot
  )
  values (
    run_id, p_dossier_id, actor, 'insurer-quote-v2',
    jsonb_build_object('dossier_id', p_dossier_id, 'lines', input_data),
    jsonb_build_object('algorithm_version', 'insurer-quote-v2', 'lines', result_data)
  );

  update public.quote_dossiers
  set workflow_status = 'compared',
      decision_estimate_id = null,
      decision_note = null
  where id = p_dossier_id;

  insert into public.quote_dossier_events(dossier_id, actor_user_id, event_type, summary, details)
  values (p_dossier_id, actor, 'comparison_saved', 'Comparaison des devis enregistrée',
    jsonb_build_object('comparison_id', run_id, 'line_count', line_total));

  return run_id;
end;
$$;

create or replace function private.add_insurer_offer_alternative(
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
  is_currently_comparable boolean;
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
      and compared_line ->> 'status' not in ('unit_mismatch', 'tax_basis_unknown')
      and compared_line ->> 'selected_product_id' = quote_line.selected_product_id::text
      and (compared_line ->> 'quantity')::numeric = quote_line.quantity
      and (compared_line ->> 'line_total')::numeric = quote_line.quantity * quote_line.unit_price
      and compared_line ->> 'currency' = quote_line.currency
      and compared_line ->> 'tax_basis' = quote_line.tax_basis
      and compared_line ->> 'condition' is not distinct from quote_line.condition
      and compared_line ->> 'quality' is not distinct from quote_line.quality
  ) into is_currently_comparable;

  if not is_currently_comparable or quote_line.tax_basis = 'unknown' then
    raise exception 'Cette ligne n’est plus comparable dans la dernière comparaison';
  end if;

  select * into supplier_offer
  from public.supplier_offers so
  where so.id = p_supplier_offer_id
    and so.status = 'published'
    and (quote_line.condition is null or so.condition = quote_line.condition)
    and (quote_line.quality is null or so.quality = quote_line.quality)
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
