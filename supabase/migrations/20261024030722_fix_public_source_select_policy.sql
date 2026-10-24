drop policy if exists sources_public_web_preview_select on public.reference_sources;
create policy sources_public_web_preview_select on public.reference_sources for select to anon using (
  exists (
    select 1 from public.reference_prices p
    where p.source_id = reference_sources.id and p.status = 'published'
      and (p.valid_from is null or p.valid_from <= current_date)
      and (p.valid_until is null or p.valid_until >= current_date)
  )
);
