-- Publish the Togo automotive schedule for the temporary public web pilot.
-- Run after the generated source import has completed.
-- The project owner approved source-faithful PM/LI/LS publication; do not normalize
-- open quality alerts or infer an unspecified tax basis.
begin;

update public.reference_entries e
set category_id = c.id,
    review_status = 'approved',
    reviewed_at = coalesce(e.reviewed_at, now()),
    review_note = coalesce(
      e.review_note,
      'Publication autorisée par le porteur du projet comme donnée de référence. PM, LI, LS, unité et base de taxe conservés comme dans la source ; cela ne vérifie ni la compatibilité véhicule, ni la disponibilité fournisseur.'
    )
from public.reference_sources s, public.categories c
where e.source_id = s.id
  and s.external_id = 'togo-reference-prices-2026-01'
  and c.slug = 'automobile'
  and c.is_active;

insert into public.products (category_id, unit_code, name, attributes, fitment_verified, status)
select
  e.category_id,
  e.unit_code,
  e.designation,
  jsonb_strip_nulls(jsonb_build_object(
    'reference_entry_external_id', e.external_id,
    'source_item_number', e.source_item_number,
    'source_family_label', f.label,
    'entry_kind', e.kind,
    'source_pdf_page', e.pdf_page,
    'source_printed_page', e.printed_page
  )),
  false,
  'published'
from public.reference_entries e
join public.reference_sources s on s.id = e.source_id
join public.source_families f on f.id = e.source_family_id
where s.external_id = 'togo-reference-prices-2026-01'
  and e.category_id is not null
  and e.kind in ('product', 'service_candidate')
  and not exists (
    select 1 from public.products p
    where p.attributes ->> 'reference_entry_external_id' = e.external_id
  );

insert into public.reference_prices (
  product_id, unit_code, source_id, reference_entry_id, revision,
  pm, li, ls, currency, tax_basis, matching_verified, status, published_at
)
select
  p.id, e.unit_code, e.source_id, e.id, 1,
  e.pm, e.li, e.ls, e.currency, e.tax_basis, true, 'published', now()
from public.reference_entries e
join public.reference_sources s on s.id = e.source_id
join public.products p on p.attributes ->> 'reference_entry_external_id' = e.external_id
where s.external_id = 'togo-reference-prices-2026-01'
  and e.kind in ('product', 'service_candidate')
  and not exists (
    select 1 from public.reference_prices rp
    where rp.reference_entry_id = e.id and rp.product_id = p.id and rp.revision = 1
  );

do $verify$
declare source_uuid uuid; entry_count bigint; product_count bigint; price_count bigint;
  issue_count bigint; bad_price_count bigint; anomaly_count bigint; unknown_tax_count bigint;
begin
  select id into strict source_uuid from public.reference_sources
  where external_id = 'togo-reference-prices-2026-01';

  select count(*) into entry_count from public.reference_entries where source_id = source_uuid;
  select count(*) into product_count from public.products p
  where p.attributes ->> 'reference_entry_external_id' in (
    select external_id from public.reference_entries where source_id = source_uuid
  );
  select count(*) into price_count from public.reference_prices
  where source_id = source_uuid and status = 'published';
  select count(*) into issue_count from public.reference_entry_issues i
  join public.reference_entries e on e.id = i.reference_entry_id
  where e.source_id = source_uuid and i.status = 'open';
  select count(*) into bad_price_count
  from public.reference_entries e
  join public.reference_prices rp on rp.reference_entry_id = e.id
  where e.source_id = source_uuid and rp.status = 'published'
    and row(rp.pm, rp.li, rp.ls, rp.currency, rp.tax_basis)
      is distinct from row(e.pm, e.li, e.ls, e.currency, e.tax_basis);
  select count(*) into anomaly_count from public.reference_entries
  where source_id = source_uuid and (pm < li or pm > ls);
  select count(*) into unknown_tax_count from public.reference_entries
  where source_id = source_uuid and tax_basis = 'unknown';

  if entry_count <> 419 or product_count <> 419 or price_count <> 419
    or issue_count <> 87 or bad_price_count <> 0
    or anomaly_count <> 4 or unknown_tax_count <> 1 then
    raise exception 'Catalogue publication verification failed: entries %, products %, prices %, open alerts %, changed prices %, triplet alerts %, unknown tax %',
      entry_count, product_count, price_count, issue_count, bad_price_count, anomaly_count, unknown_tax_count;
  end if;
end;
$verify$;

commit;
