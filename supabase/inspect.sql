-- Read-only overview. Run with an administrative database connection.
select jsonb_build_object(
  'source_documents', (select count(*) from public.reference_sources),
  'source_groups', (select count(*) from public.source_groups),
  'source_families', (select count(*) from public.source_families),
  'reference_entries', (select count(*) from public.reference_entries),
  'distinct_source_numbers', (select count(distinct source_item_number) from public.reference_entries),
  'flagged_entries', (select count(*) from public.reference_entries where review_status = 'needs_review'),
  'open_issues', (select count(*) from public.reference_entry_issues where status = 'open'),
  'published_prices', (select count(*) from public.reference_prices where status = 'published'),
  'active_plans', (select count(*) from public.subscription_plans where is_active),
  'imports', (select jsonb_agg(jsonb_build_object('source_id', source_id, 'status', status)) from private.reference_imports),
  'application_tables', (select count(*) from pg_tables where schemaname in ('public', 'private')),
  'tables_without_rls', (select count(*) from pg_tables where schemaname in ('public', 'private') and not rowsecurity)
) as overview;

select review_status, count(*) from public.reference_entries group by review_status order by review_status;
select code, count(*) from public.reference_entry_issues group by code order by code;

select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated') and table_schema in ('public', 'private')
  and (table_schema = 'private' or table_name in ('payments', 'subscriptions', 'reference_entries', 'reference_prices'))
order by table_schema, table_name, privilege_type;
