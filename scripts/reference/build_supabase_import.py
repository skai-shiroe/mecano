#!/usr/bin/env python3
"""Build idempotent, unpublished Supabase import batches from reviewed extraction files."""

import argparse
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent


def literal_json(value):
    data = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    marker = '$check_' + hashlib.sha256(data.encode()).hexdigest()[:16] + '$'
    if marker in data:
        raise ValueError('Unexpected dollar-quote marker in input')
    return marker + data + marker + '::jsonb'


def batches(values, limit):
    result, current, size = [], [], 0
    for value in values:
        item_size = len(json.dumps(value, ensure_ascii=False).encode())
        if current and size + item_size > limit:
            result.append(current)
            current, size = [], 0
        current.append(value)
        size += item_size
    if current:
        result.append(current)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=HERE.parent.parent / 'data/reference/2026-01')
    parser.add_argument('--output', type=Path, default=HERE.parent.parent / 'supabase/imports/2026-01')
    parser.add_argument('--batch-bytes', type=int, default=24000)
    args = parser.parse_args()
    base = args.data
    load = lambda name: json.loads((base / name).read_text(encoding='utf-8'))
    manifest, taxonomy, rows = load('manifest.json'), load('taxonomy.json'), load('automotive.json')
    quality, queue = load('quality-report.json'), load('review-queue.json')
    raw = {r['id']: r for r in (json.loads(line) for line in (base / 'raw/automotive.jsonl').read_text().splitlines())}
    for item in manifest['artifacts']:
        if hashlib.sha256((base / item['path']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Artifact hash mismatch: ' + item['path'])
    if len(rows) != quality['extracted_rows'] or any(r['review']['published'] for r in rows):
        raise ValueError('Expected the unpublished preparation dataset')
    if {r['id'] for r in rows} != set(raw):
        raise ValueError('Raw and normalized rows do not reconcile')

    source_json = literal_json(manifest)
    source_filter = 'external_id = ' + literal_json(manifest['source_id']) + " #>> '{}'"
    # A scalar JSON literal avoids ad hoc quoting of IDs in generated SQL.
    source = f'(select id from public.reference_sources where {source_filter})'
    groups = [{**g, 'category_slug': 'automobile' if g['number'] == 23 else f"famille-{g['number']:02d}"} for g in taxonomy['groups']]
    unit_labels = {
        'unite': ('Unité', 'count'), 'piece': ('Pièce', 'count'), 'ensemble': ('Ensemble', 'package'),
        'jeu': ('Jeu', 'package'), 'paire': ('Paire', 'count'), 'litre': ('Litre', 'volume'),
        '5_litres': ('5 litres', 'volume'), 'bidon_5_litres': ('Bidon de 5 litres', 'package'),
        '0_5_litre': ('0,5 litre', 'volume'), 'kilogramme': ('Kilogramme', 'mass'), 'boite': ('Boîte', 'package'),
    }
    units = [{'code': code, 'label': unit_labels[code][0], 'dimension': unit_labels[code][1]} for code in sorted({r['unit'] for r in rows})]
    setup = f'''
with m as (select {source_json} as value)
insert into public.reference_sources(external_id, title, edition, sha256, byte_size, page_count, received_on, provenance, manifest)
select value->>'source_id', 'Répertoire des prix de référence - Togo', value->>'edition', value->>'sha256',
  (value->>'byte_size')::bigint, (value->>'page_count')::integer, (value->>'received_on')::date, value->>'provenance', value
from m on conflict (external_id) do nothing;
do $guard$
begin
  if not exists (select 1 from public.reference_sources where {source_filter}
    and sha256 = ({source_json})->>'sha256') then
    raise exception 'Existing source identity differs from the prepared manifest';
  end if;
end;
$guard$;
insert into public.units(code, label, dimension)
select code, label, dimension from jsonb_to_recordset({literal_json(units)}) as x(code text, label text, dimension text)
on conflict (code) do nothing;
insert into public.subscription_plans(code, name, audience, billing_basis)
values ('pilot_personal', 'Pilote particuliers - tarif à définir', 'personal', 'per_user'),
       ('pilot_insurer', 'Pilote assureurs - formule à définir', 'organization', null)
on conflict (code) do nothing;
insert into public.categories(slug, name, is_active, sort_order)
select x.category_slug, case when x.number = 23 then 'Automobile' else x.label end, x.number = 23, x.number
from jsonb_to_recordset({literal_json(groups)}) as x(category_slug text, label text, number integer)
on conflict (slug) do nothing;
insert into public.source_groups(source_id, external_id, ordinal, label_raw, chapter_label_raw, declared_items, first_pdf_page, last_pdf_page, printed_start, category_id)
select {source}, x.id, x.number, x.label_raw, x.chapter_label_raw, x.declared_items, x.first_pdf_page, x.last_pdf_page, x.printed_start, c.id
from jsonb_to_recordset({literal_json(groups)}) as x(id text, number integer, label_raw text, chapter_label_raw text, declared_items integer,
  first_pdf_page integer, last_pdf_page integer, printed_start integer, category_slug text)
join public.categories c on c.slug = x.category_slug
on conflict (source_id, external_id) do nothing;
insert into private.reference_imports(source_id, expected_groups, expected_families, expected_entries, expected_issues, quality_report)
values ({source}, {len(groups)}, {len(taxonomy['families'])}, {len(rows)}, {sum(len(q['issues']) for q in queue)}, {literal_json(quality)})
on conflict (source_id) do nothing;
'''
    tasks = [('prepare_source', setup)]
    for index, chunk in enumerate(batches(taxonomy['families'], args.batch_bytes), 1):
        tasks.append((f'families_{index:03d}', f'''
insert into public.source_families(source_id, source_group_id, external_id, ordinal_raw, code_raw, label, label_variants, source_pages)
select {source}, g.id, x.id, x.ordinal_raw, x.code_raw, x.label, x.label_variants, x.source_pages
from jsonb_to_recordset({literal_json(chunk)}) as x(id text, group_id text, ordinal_raw text, code_raw text, label text, label_variants jsonb, source_pages jsonb)
join public.source_groups g on g.source_id = {source} and g.external_id = x.group_id
on conflict (source_id, external_id) do nothing;
'''))
    entries = [{**r, 'raw_cells': raw[r['id']]['cells']} for r in rows]
    for index, chunk in enumerate(batches(entries, args.batch_bytes), 1):
        tasks.append((f'entries_{index:03d}', f'''
insert into public.reference_entries(source_id, source_family_id, external_id, source_item_number, designation,
  unit_raw, unit_code, kind, pm, li, ls, currency, tax_basis, pdf_page, printed_page, table_index, row_index,
  source_location, raw_cells, source_payload, review_status)
select {source}, f.id, x.id, x.source_item_number, x.designation, x.unit_raw, x.unit, x.kind,
  (x.prices->>'pm')::numeric, (x.prices->>'li')::numeric, (x.prices->>'ls')::numeric,
  x.prices->>'currency', x.prices->>'tax_basis', (x.source->>'pdf_page')::integer,
  (x.source->>'printed_page')::integer, (x.source->>'table_index')::integer, (x.source->>'row_index')::integer,
  x.source, x.raw_cells, p.value, x.review->>'status'
from jsonb_array_elements({literal_json(chunk)}) as p(value)
cross join lateral jsonb_to_record(p.value) as x(id text, family_id text, source_item_number text, designation text,
  unit_raw text, unit text, kind text, prices jsonb, source jsonb, raw_cells jsonb, review jsonb)
join public.source_families f on f.source_id = {source} and f.external_id = x.family_id
on conflict (source_id, external_id) do nothing;
'''))
    issues = [{'entry_id': q['id'], **issue} for q in queue for issue in q['issues']]
    for index, chunk in enumerate(batches(issues, args.batch_bytes), 1):
        tasks.append((f'issues_{index:03d}', f'''
insert into public.reference_entry_issues(reference_entry_id, code, message)
select e.id, x.code, x.message
from jsonb_to_recordset({literal_json(chunk)}) as x(entry_id text, code text, message text)
join public.reference_entries e on e.source_id = {source} and e.external_id = x.entry_id
on conflict (reference_entry_id, code) do nothing;
'''))
    finish = f'''
do $finish$
declare source_uuid uuid := {source}; actual record; expected record;
begin
  select * into strict expected from private.reference_imports where source_id = source_uuid;
  select
    (select count(*) from public.source_groups where source_id = source_uuid) as groups,
    (select count(*) from public.source_families where source_id = source_uuid) as families,
    (select count(*) from public.reference_entries where source_id = source_uuid) as entries,
    (select count(*) from public.reference_entry_issues i join public.reference_entries e on e.id = i.reference_entry_id where e.source_id = source_uuid) as issues
  into actual;
  if actual.groups <> expected.expected_groups or actual.families <> expected.expected_families
    or actual.entries <> expected.expected_entries or actual.issues <> expected.expected_issues then
    raise exception 'Import counts do not match the prepared extraction: %', row_to_json(actual);
  end if;
  update private.reference_imports set status = 'completed', completed_at = coalesce(completed_at, now()) where source_id = source_uuid;
end;
$finish$;
'''
    tasks.append(('complete_import', finish))
    args.output.mkdir(parents=True, exist_ok=True)
    files = []
    for index, (name, sql) in enumerate(tasks):
        filename = f'{index:03d}_{name}.sql'
        sql = '-- Generated by scripts/reference/build_supabase_import.py. No automatic publication.\nbegin;\n' + sql.strip() + '\ncommit;\n-- end-check-import\n'
        path = args.output / filename
        path.write_text(sql, encoding='utf-8')
        files.append({'path': filename, 'characters': len(sql), 'sha256': hashlib.sha256(sql.encode()).hexdigest()})
    summary = {'source_id': manifest['source_id'], 'source_sha256': manifest['sha256'],
               'expected': {'groups': len(groups), 'families': len(taxonomy['families']), 'entries': len(rows),
                            'issues': len(issues), 'flagged_entries': len(queue), 'units': len(units), 'published_prices': 0},
               'files': files}
    (args.output / 'import-manifest.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'batches': len(tasks), **summary['expected'], 'max_characters': max(f['characters'] for f in files)}, indent=2))


if __name__ == '__main__':
    main()
