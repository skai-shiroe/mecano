-- Allow insurers to select a saved supplier offer as the dossier decision.
alter table public.quote_dossiers
  add column decision_offer_alternative_id uuid
    references public.quote_line_offer_alternatives(id) on delete set null,
  add constraint quote_dossiers_single_decision_target_check
    check (decision_estimate_id is null or decision_offer_alternative_id is null);

create index quote_dossiers_decision_offer_alternative_idx
  on public.quote_dossiers(decision_offer_alternative_id)
  where decision_offer_alternative_id is not null;

create or replace function private.log_insurer_dossier_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  event_type text;
  event_summary text;
  event_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    event_type := 'created';
    event_summary := 'Dossier créé';
  elsif new.assigned_user_id is distinct from old.assigned_user_id then
    event_type := 'assignment_changed';
    event_summary := case when new.assigned_user_id is null then 'Dossier retiré des tâches attribuées'
      else 'Dossier attribué à un membre de l’organisation' end;
    event_details := jsonb_build_object('assigned_user_id', new.assigned_user_id);
  elsif new.decision_estimate_id is distinct from old.decision_estimate_id
     or new.decision_offer_alternative_id is distinct from old.decision_offer_alternative_id
     or new.decision_note is distinct from old.decision_note then
    if new.decision_estimate_id is null and new.decision_offer_alternative_id is null then
      event_type := 'status_changed';
      event_summary := case new.workflow_status
        when 'to_review' then 'Décision retirée après modification des devis'
        when 'compared' then 'Nouvelle comparaison enregistrée, décision à reprendre'
        else 'Décision retirée'
      end;
      event_details := jsonb_build_object('status', new.workflow_status);
    elsif new.decision_offer_alternative_id is not null then
      event_type := 'decision_recorded';
      select jsonb_build_object(
        'decision_type', 'supplier_offer',
        'alternative_id', a.id,
        'supplier_offer_id', a.supplier_offer_id,
        'supplier_name', a.supplier_name,
        'product_name', a.product_name,
        'quantity', a.quantity,
        'unit_price', a.unit_price,
        'delivery_fee', a.delivery_fee,
        'delivered_total', a.unit_price * a.quantity + a.delivery_fee,
        'currency', a.currency
      )
      into event_details
      from public.quote_line_offer_alternatives a
      where a.id = new.decision_offer_alternative_id;
      event_summary := 'Offre fournisseur retenue · ' || coalesce(event_details ->> 'supplier_name', 'Fournisseur');
    else
      event_type := 'decision_recorded';
      event_summary := 'Devis retenu';
      event_details := jsonb_build_object(
        'decision_type', 'quote',
        'estimate_id', new.decision_estimate_id
      );
    end if;
  elsif new.archived_at is distinct from old.archived_at and new.archived_at is not null then
    event_type := 'archived';
    event_summary := 'Dossier archivé';
  elsif new.workflow_status is distinct from old.workflow_status then
    event_type := 'status_changed';
    event_summary := case new.workflow_status
      when 'to_review' then 'Dossier remis à examiner après modification'
      when 'compared' then 'Comparaison enregistrée'
      when 'decision_recorded' then 'Décision enregistrée'
      else 'État du dossier modifié'
    end;
    event_details := jsonb_build_object('status', new.workflow_status);
  else
    return new;
  end if;

  insert into public.quote_dossier_events(dossier_id, actor_user_id, event_type, summary, details)
  values (new.id, auth.uid(), event_type, left(event_summary, 300), coalesce(event_details, '{}'::jsonb));
  return new;
end;
$$;

create or replace function private.invalidate_insurer_comparison() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dossier uuid;
begin
  dossier := coalesce(new.dossier_id, old.dossier_id);
  update public.quote_dossiers
  set workflow_status = 'to_review',
      decision_estimate_id = null,
      decision_offer_alternative_id = null,
      decision_note = null
  where id = dossier
    and (
      workflow_status <> 'to_review'
      or decision_estimate_id is not null
      or decision_offer_alternative_id is not null
      or decision_note is not null
    );
  return coalesce(new, old);
end;
$$;

create or replace function private.record_insurer_decision(
  p_dossier_id uuid,
  p_estimate_id uuid,
  p_decision_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.can_access_insurer_dossier(p_dossier_id) then
    raise exception 'Accès refusé à ce dossier';
  end if;
  if not exists (
    select 1 from public.quote_dossiers d
    where d.id = p_dossier_id and d.archived_at is null and d.workflow_status = 'compared'
  ) then
    raise exception 'Compare les devis après leur dernière modification avant d’enregistrer une décision';
  end if;
  if p_decision_note is not null and char_length(p_decision_note) > 3000 then
    raise exception 'La note de décision dépasse 3 000 caractères';
  end if;
  if not exists (
    select 1 from public.quote_estimates qe
    where qe.id = p_estimate_id and qe.dossier_id = p_dossier_id
  ) then
    raise exception 'Le devis retenu ne fait pas partie de ce dossier';
  end if;

  update public.quote_dossiers
  set decision_estimate_id = p_estimate_id,
      decision_offer_alternative_id = null,
      decision_note = nullif(btrim(p_decision_note), ''),
      workflow_status = 'decision_recorded'
  where id = p_dossier_id and archived_at is null;
  if not found then raise exception 'Le dossier est introuvable ou archivé'; end if;
end;
$$;

create function private.record_insurer_offer_decision(
  p_dossier_id uuid,
  p_alternative_id uuid,
  p_decision_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  chosen_alternative public.quote_line_offer_alternatives%rowtype;
begin
  if auth.uid() is null or not private.can_access_insurer_dossier(p_dossier_id) then
    raise exception 'Accès refusé à ce dossier';
  end if;
  if not exists (
    select 1 from public.quote_dossiers d
    where d.id = p_dossier_id and d.archived_at is null and d.workflow_status = 'compared'
  ) then
    raise exception 'Compare les devis avant d’enregistrer la solution retenue';
  end if;
  if p_decision_note is not null and char_length(p_decision_note) > 3000 then
    raise exception 'La note de décision dépasse 3 000 caractères';
  end if;

  select a.* into chosen_alternative
  from public.quote_line_offer_alternatives a
  where a.id = p_alternative_id and a.dossier_id = p_dossier_id
  for share;
  if not found then
    raise exception 'Cette offre partenaire ne fait pas partie de ce dossier';
  end if;
  if chosen_alternative.valid_until is not null and chosen_alternative.valid_until < current_date then
    raise exception 'Cette offre partenaire a expiré. Vérifie son prix et sa disponibilité avant de la retenir';
  end if;

  update public.quote_dossiers
  set decision_estimate_id = null,
      decision_offer_alternative_id = chosen_alternative.id,
      decision_note = nullif(btrim(p_decision_note), ''),
      workflow_status = 'decision_recorded'
  where id = p_dossier_id and archived_at is null;
  if not found then raise exception 'Le dossier est introuvable ou archivé'; end if;
end;
$$;

create function public.record_insurer_offer_decision(
  p_dossier_id uuid,
  p_alternative_id uuid,
  p_decision_note text default null
) returns void
language sql security invoker set search_path = '' as $$
  select private.record_insurer_offer_decision(p_dossier_id, p_alternative_id, p_decision_note);
$$;

revoke execute on function private.record_insurer_offer_decision(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.record_insurer_offer_decision(uuid, uuid, text) to authenticated;
revoke all on function public.record_insurer_offer_decision(uuid, uuid, text) from public, anon;
grant execute on function public.record_insurer_offer_decision(uuid, uuid, text) to authenticated;

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
      decision_offer_alternative_id = null,
      decision_note = null
  where id = p_dossier_id;

  insert into public.quote_dossier_events(dossier_id, actor_user_id, event_type, summary, details)
  values (p_dossier_id, actor, 'comparison_saved', 'Comparaison des devis enregistrée',
    jsonb_build_object('comparison_id', run_id, 'line_count', line_total));

  return run_id;
end;
$$;

comment on column public.quote_dossiers.decision_offer_alternative_id is
  'Supplier offer alternative selected as the insurer decision for this dossier.';
