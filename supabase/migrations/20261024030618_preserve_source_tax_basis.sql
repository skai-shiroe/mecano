-- The source does not state a tax basis for every line.
-- Keep the source value "unknown" for that entry rather than inferring HT or TTC.
alter table public.reference_prices drop constraint if exists reference_prices_published_values_check;
alter table public.reference_prices add constraint reference_prices_published_values_check
  check (status <> 'published' or (
    pm > 0 and li > 0 and ls > 0
    and matching_verified
    and published_at is not null
  ));
