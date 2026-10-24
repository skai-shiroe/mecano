-- Professional insurer workflow: a claim dossier can contain several supplier quotes.
-- During the pilot, active insurer members receive catalog access without a payment
-- integration; personal access remains governed by verified subscriptions.

create table public.quote_estimates (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.quote_dossiers(id) on delete cascade,
  supplier_name text not null check (char_length(btrim(supplier_name)) between 1 and 200),
  quote_reference text check (quote_reference is null or char_length(quote_reference) <= 120),
  quote_date date,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, dossier_id)
);
create index quote_estimates_dossier_recent_idx
  on public.quote_estimates(dossier_id, created_at desc);
create trigger quote_estimates_touch_updated_at
before update on public.quote_estimates
for each row execute function private.touch_updated_at();

alter table public.quote_lines
  add column quote_estimate_id uuid;

alter table public.quote_lines
  add constraint quote_lines_estimate_dossier_fkey
  foreign key (quote_estimate_id, dossier_id)
  references public.quote_estimates(id, dossier_id)
  on delete cascade;

alter table public.quote_lines
  drop constraint if exists quote_lines_dossier_id_position_key;

create unique index quote_lines_estimate_position_unique_idx
  on public.quote_lines(quote_estimate_id, position)
  where quote_estimate_id is not null;
create unique index quote_lines_personal_position_unique_idx
  on public.quote_lines(dossier_id, position)
  where quote_estimate_id is null;

-- Preserve previously saved insurer quote lines in a clearly identified legacy estimate.
with inserted_estimates as (
  insert into public.quote_estimates(dossier_id, supplier_name, quote_reference, quote_date)
  select distinct ql.dossier_id, 'Garage non précisé', 'Devis existant', current_date
  from public.quote_lines ql
  join public.quote_dossiers d on d.id = ql.dossier_id
  where ql.quote_estimate_id is null and d.organization_id is not null
  returning id, dossier_id
)
update public.quote_lines ql
set quote_estimate_id = inserted_estimates.id
from inserted_estimates
where ql.dossier_id = inserted_estimates.dossier_id
  and ql.quote_estimate_id is null;

alter table public.quote_dossiers
  add column workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'to_review', 'compared', 'decision_recorded')),
  add column assigned_user_id uuid references public.profiles(id) on delete set null,
  add column decision_estimate_id uuid references public.quote_estimates(id) on delete set null,
  add column decision_note text check (decision_note is null or char_length(decision_note) <= 3000);

create index quote_dossiers_org_workflow_idx
  on public.quote_dossiers(organization_id, workflow_status, updated_at desc);
create index quote_dossiers_assignee_idx
  on public.quote_dossiers(assigned_user_id, updated_at desc)
  where assigned_user_id is not null;

create table public.quote_dossier_events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.quote_dossiers(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'created', 'quote_added', 'quote_updated', 'quote_removed',
    'assignment_changed', 'comparison_saved', 'decision_recorded',
    'status_changed', 'archived'
  )),
  summary text not null check (char_length(btrim(summary)) between 1 and 300),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index quote_dossier_events_recent_idx
  on public.quote_dossier_events(dossier_id, created_at desc);

alter table public.quote_estimates enable row level security;
alter table public.quote_dossier_events enable row level security;
revoke all on public.quote_estimates, public.quote_dossier_events from public, anon, authenticated;
grant select on public.quote_estimates, public.quote_dossier_events to authenticated;
grant insert (dossier_id, supplier_name, quote_reference, quote_date)
  on public.quote_estimates to authenticated;
grant update (supplier_name, quote_reference, quote_date)
  on public.quote_estimates to authenticated;
grant delete on public.quote_estimates to authenticated;
grant insert (quote_estimate_id) on public.quote_lines to authenticated;
grant update (quote_estimate_id) on public.quote_lines to authenticated;

create function private.has_insurer_workspace_access(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organizations o
    join public.organization_memberships m on m.organization_id = o.id
    where o.id = p_organization_id and o.kind = 'insurer' and o.is_active
      and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function private.has_catalog_access(organization uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    (organization is not null and private.has_insurer_workspace_access(organization))
    or exists (
      select 1 from public.subscriptions s
      join public.payments p on p.id = s.activation_payment_id and p.subscription_id = s.id
      where s.status = 'active' and s.period_start <= statement_timestamp() and s.period_end > statement_timestamp()
        and p.status = 'succeeded' and p.verified_at is not null
        and p.amount = s.amount and p.currency = s.currency
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
    )
  );
$$;

create or replace function private.has_any_catalog_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    private.has_catalog_access(null)
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = auth.uid() and m.is_active
        and (private.has_insurer_workspace_access(m.organization_id)
          or private.has_catalog_access(m.organization_id))
    )
  );
$$;

create function private.can_access_insurer_dossier(p_dossier_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.quote_dossiers d
    where d.id = p_dossier_id
      and d.organization_id is not null
      and private.has_insurer_workspace_access(d.organization_id)
      and (
        private.is_org_manager(d.organization_id)
        or d.created_by = auth.uid()
        or d.assigned_user_id = auth.uid()
      )
  );
$$;

drop policy dossiers_scoped_select on public.quote_dossiers;
create policy dossiers_scoped_select on public.quote_dossiers
for select to authenticated using (
  owner_user_id = (select auth.uid())
  or private.can_access_insurer_dossier(id)
);

drop policy dossiers_paid_insert on public.quote_dossiers;
create policy dossiers_paid_insert on public.quote_dossiers
for insert to authenticated with check (
  created_by = (select auth.uid())
  and private.has_catalog_access(organization_id)
  and (
    owner_user_id = (select auth.uid())
    or (organization_id is not null and private.has_insurer_workspace_access(organization_id))
  )
);

drop policy dossiers_scoped_update on public.quote_dossiers;
create policy dossiers_scoped_update on public.quote_dossiers
for update to authenticated using (
  owner_user_id = (select auth.uid())
  or private.can_access_insurer_dossier(id)
) with check (
  owner_user_id = (select auth.uid())
  or private.can_access_insurer_dossier(id)
);

create policy quote_estimates_scoped_select on public.quote_estimates
for select to authenticated using (
  private.can_access_insurer_dossier(dossier_id)
);

create policy quote_estimates_scoped_insert on public.quote_estimates
for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.quote_dossiers d
    where d.id = dossier_id and d.organization_id is not null and d.archived_at is null
      and private.can_access_insurer_dossier(d.id)
      and private.has_catalog_access(d.organization_id)
  )
);

create policy quote_estimates_scoped_update on public.quote_estimates
for update to authenticated using (
  private.can_access_insurer_dossier(dossier_id)
  and exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null)
) with check (
  private.can_access_insurer_dossier(dossier_id)
  and exists (select 1 from public.quote_dossiers d where d.id = dossier_id and d.archived_at is null)
);

create policy quote_estimates_scoped_delete on public.quote_estimates
for delete to authenticated using (
  private.can_access_insurer_dossier(dossier_id)
  and exists (
    select 1 from public.quote_dossiers d
    where d.id = dossier_id and d.archived_at is null
      and d.decision_estimate_id is distinct from quote_estimates.id
  )
);

create policy quote_dossier_events_scoped_select on public.quote_dossier_events
for select to authenticated using (
  private.can_access_insurer_dossier(dossier_id)
);

drop policy quote_lines_paid_insert on public.quote_lines;
create policy quote_lines_paid_insert on public.quote_lines
for insert to authenticated with check (
  exists (
    select 1
    from public.quote_dossiers d
    where d.id = dossier_id and d.archived_at is null
      and private.has_catalog_access(d.organization_id)
      and (d.organization_id is null or quote_estimate_id is not null)
      and (
        d.organization_id is null
        or (
          private.can_access_insurer_dossier(d.id)
          and exists (
            select 1 from public.quote_estimates qe
            where qe.id = quote_estimate_id and qe.dossier_id = d.id
          )
        )
      )
  )
  and (
    selected_product_id is null
    or exists (select 1 from public.products p where p.id = selected_product_id and p.status = 'published')
  )
);

drop policy quote_lines_paid_update on public.quote_lines;
create policy quote_lines_paid_update on public.quote_lines
for update to authenticated using (
  exists (
    select 1 from public.quote_dossiers d
    where d.id = dossier_id and d.archived_at is null
      and private.has_catalog_access(d.organization_id)
      and (d.organization_id is null or private.can_access_insurer_dossier(d.id))
  )
) with check (
  exists (
    select 1 from public.quote_dossiers d
    where d.id = dossier_id and d.archived_at is null
      and private.has_catalog_access(d.organization_id)
      and (d.organization_id is null or private.can_access_insurer_dossier(d.id))
      and (
        d.organization_id is null
        or exists (
          select 1 from public.quote_estimates qe
          where qe.id = quote_estimate_id and qe.dossier_id = d.id
        )
      )
  )
  and (
    selected_product_id is null
    or exists (select 1 from public.products p where p.id = selected_product_id and p.status = 'published')
  )
);

drop policy quote_lines_paid_delete on public.quote_lines;
create policy quote_lines_paid_delete on public.quote_lines
for delete to authenticated using (
  exists (
    select 1 from public.quote_dossiers d
    where d.id = dossier_id and d.archived_at is null
      and private.has_catalog_access(d.organization_id)
      and (d.organization_id is null or private.can_access_insurer_dossier(d.id))
  )
);

create function private.log_insurer_dossier_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_type text; event_summary text; event_details jsonb := '{}'::jsonb;
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
     or new.decision_note is distinct from old.decision_note then
    if new.decision_estimate_id is null then
      event_type := 'status_changed';
      event_summary := case new.workflow_status
        when 'to_review' then 'Décision retirée après modification des devis'
        when 'compared' then 'Nouvelle comparaison enregistrée, décision à reprendre'
        else 'Décision retirée'
      end;
      event_details := jsonb_build_object('status', new.workflow_status);
    else
      event_type := 'decision_recorded';
      event_summary := 'Décision enregistrée';
      event_details := jsonb_build_object('estimate_id', new.decision_estimate_id);
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
  values (new.id, auth.uid(), event_type, event_summary, event_details);
  return new;
end;
$$;

create function private.log_insurer_quote_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dossier uuid; event_type text; event_summary text; quote_id uuid; supplier text;
begin
  dossier := coalesce(new.dossier_id, old.dossier_id);
  quote_id := coalesce(new.id, old.id);
  supplier := coalesce(new.supplier_name, old.supplier_name);
  if tg_op = 'INSERT' then
    event_type := 'quote_added';
    event_summary := 'Devis ajouté · ' || supplier;
  elsif tg_op = 'DELETE' then
    event_type := 'quote_removed';
    event_summary := 'Devis supprimé · ' || supplier;
  else
    event_type := 'quote_updated';
    event_summary := 'Devis modifié · ' || supplier;
  end if;

  insert into public.quote_dossier_events(dossier_id, actor_user_id, event_type, summary, details)
  values (dossier, auth.uid(), event_type, left(event_summary, 300),
    jsonb_build_object('estimate_id', quote_id));
  return coalesce(new, old);
end;
$$;

create function private.invalidate_insurer_comparison() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dossier uuid;
begin
  dossier := coalesce(new.dossier_id, old.dossier_id);
  update public.quote_dossiers
  set workflow_status = 'to_review',
      decision_estimate_id = null,
      decision_note = null
  where id = dossier
    and (workflow_status <> 'to_review' or decision_estimate_id is not null or decision_note is not null);
  return coalesce(new, old);
end;
$$;

create trigger quote_dossiers_event_log
after insert or update on public.quote_dossiers
for each row execute function private.log_insurer_dossier_change();

create trigger quote_estimates_event_log
after insert or update or delete on public.quote_estimates
for each row execute function private.log_insurer_quote_change();

create trigger quote_estimates_invalidate_comparison
after insert or update or delete on public.quote_estimates
for each row execute function private.invalidate_insurer_comparison();

create trigger quote_lines_invalidate_comparison
after insert or update or delete on public.quote_lines
for each row execute function private.invalidate_insurer_comparison();

create function private.save_insurer_estimate(
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
      unit_price numeric, currency text, tax_basis text, tax_rate numeric,
      selected_product_id uuid, matching_note text
    )
    where line.position is null or line.position < 1
      or nullif(btrim(line.designation), '') is null
      or char_length(line.designation) > 1000
      or line.quantity is null or line.quantity <= 0 or line.quantity >= 'Infinity'::numeric
      or line.unit_price is null or line.unit_price < 0 or line.unit_price >= 'Infinity'::numeric
      or line.currency is null or line.currency !~ '^[A-Z]{3}$'
      or line.tax_basis is null or line.tax_basis not in ('HT', 'TTC', 'unknown')
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
    unit_price, currency, tax_basis, tax_rate, selected_product_id, matching_note
  )
  select
    dossier, p_estimate_id, line.position, btrim(line.designation), line.quantity,
    line.unit_code, line.unit_price, line.currency, line.tax_basis, line.tax_rate,
    line.selected_product_id, nullif(btrim(line.matching_note), '')
  from jsonb_to_recordset(p_lines) as line(
    position integer, designation text, quantity numeric, unit_code text,
    unit_price numeric, currency text, tax_basis text, tax_rate numeric,
    selected_product_id uuid, matching_note text
  )
  order by line.position;
end;
$$;

create function public.save_insurer_estimate(
  p_estimate_id uuid,
  p_supplier_name text,
  p_quote_reference text,
  p_quote_date date,
  p_lines jsonb
) returns void
language sql security invoker set search_path = '' as $$
  select private.save_insurer_estimate(
    p_estimate_id, p_supplier_name, p_quote_reference, p_quote_date, p_lines
  );
$$;

create function private.compare_insurer_dossier(p_dossier_id uuid) returns uuid
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
      'tax_rate', tax_rate, 'currency', currency, 'tax_basis', tax_basis, 'unit_code', unit_code,
      'selected_product_id', selected_product_id, 'product_name', product_name
    ) order by supplier_name, quote_id, position), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'quote_id', quote_id, 'supplier_name', supplier_name, 'quote_reference', quote_reference,
      'quote_date', quote_date, 'line_id', line_id, 'position', position,
      'designation', designation, 'quantity', quantity, 'unit_price', unit_price,
      'tax_rate', tax_rate, 'line_total', quantity * unit_price, 'currency', currency, 'tax_basis', tax_basis,
      'unit_code', unit_code, 'selected_product_id', selected_product_id,
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
    run_id, p_dossier_id, actor, 'insurer-quote-v1',
    jsonb_build_object('dossier_id', p_dossier_id, 'lines', input_data),
    jsonb_build_object('algorithm_version', 'insurer-quote-v1', 'lines', result_data)
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

create function public.compare_insurer_dossier(p_dossier_id uuid) returns uuid
language sql security invoker set search_path = '' as $$
  select private.compare_insurer_dossier(p_dossier_id);
$$;

create function private.assign_insurer_dossier(p_dossier_id uuid, p_assignee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare organization uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select organization_id into organization
  from public.quote_dossiers where id = p_dossier_id and organization_id is not null;
  if not found or not private.is_org_manager(organization) then
    raise exception 'Seul le responsable de l’organisation peut attribuer ce dossier';
  end if;

  if p_assignee_id is not null and not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = organization and m.user_id = p_assignee_id and m.is_active
  ) then
    raise exception 'Le membre choisi n’appartient pas à cette organisation active';
  end if;

  update public.quote_dossiers set assigned_user_id = p_assignee_id
  where id = p_dossier_id and archived_at is null;
  if not found then raise exception 'Le dossier est introuvable ou archivé'; end if;
end;
$$;

create function public.assign_insurer_dossier(p_dossier_id uuid, p_assignee_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select private.assign_insurer_dossier(p_dossier_id, p_assignee_id);
$$;

create function private.record_insurer_decision(
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
      decision_note = nullif(btrim(p_decision_note), ''),
      workflow_status = 'decision_recorded'
  where id = p_dossier_id and archived_at is null;
  if not found then raise exception 'Le dossier est introuvable ou archivé'; end if;
end;
$$;

create function public.record_insurer_decision(
  p_dossier_id uuid,
  p_estimate_id uuid,
  p_decision_note text default null
) returns void
language sql security invoker set search_path = '' as $$
  select private.record_insurer_decision(p_dossier_id, p_estimate_id, p_decision_note);
$$;

revoke execute on function private.has_insurer_workspace_access(uuid),
  private.can_access_insurer_dossier(uuid), private.save_insurer_estimate(uuid, text, text, date, jsonb),
  private.compare_insurer_dossier(uuid), private.assign_insurer_dossier(uuid, uuid),
  private.record_insurer_decision(uuid, uuid, text),
  private.log_insurer_dossier_change(), private.log_insurer_quote_change(),
  private.invalidate_insurer_comparison()
  from public, anon, authenticated;
grant execute on function private.has_insurer_workspace_access(uuid),
  private.can_access_insurer_dossier(uuid), private.save_insurer_estimate(uuid, text, text, date, jsonb),
  private.compare_insurer_dossier(uuid), private.assign_insurer_dossier(uuid, uuid),
  private.record_insurer_decision(uuid, uuid, text)
  to authenticated;

revoke all on function public.save_insurer_estimate(uuid, text, text, date, jsonb),
  public.compare_insurer_dossier(uuid), public.assign_insurer_dossier(uuid, uuid),
  public.record_insurer_decision(uuid, uuid, text)
  from public, anon;
grant execute on function public.save_insurer_estimate(uuid, text, text, date, jsonb),
  public.compare_insurer_dossier(uuid), public.assign_insurer_dossier(uuid, uuid),
  public.record_insurer_decision(uuid, uuid, text)
  to authenticated;

comment on table public.quote_estimates is
  'A supplier quote submitted for an insurer claim dossier. One dossier can contain competing estimates.';
comment on table public.quote_dossier_events is
  'Read-only professional dossier timeline. Event metadata excludes quote line contents.';
comment on function public.compare_insurer_dossier(uuid) is
  'Creates an immutable comparison snapshot for every quote line in one insurer dossier.';
