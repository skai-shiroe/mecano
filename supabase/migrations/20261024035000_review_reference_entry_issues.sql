-- Allow catalog administrators to resolve, dismiss, and reopen import-review alerts.
-- The source facts (designation and price values) remain immutable.
create or replace function public.resolve_reference_entry_issue(
  p_issue_id uuid,
  p_status text,
  p_resolution_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_issue_id uuid;
begin
  if auth.uid() is null or not private.is_catalog_admin() then
    raise insufficient_privilege using message = 'Catalog administrator access is required';
  end if;

  if p_status is null or p_status not in ('open', 'resolved', 'dismissed') then
    raise check_violation using message = 'Choose open, resolved, or dismissed';
  end if;

  if p_status = 'open' then
    update public.reference_entry_issues
    set status = 'open',
        resolution_note = null,
        resolved_by = null,
        resolved_at = null
    where id = p_issue_id
    returning id into updated_issue_id;
  else
    if nullif(btrim(p_resolution_note), '') is null
       or char_length(btrim(p_resolution_note)) < 5
       or char_length(btrim(p_resolution_note)) > 1000 then
      raise check_violation using message = 'A resolution note between 5 and 1000 characters is required';
    end if;

    update public.reference_entry_issues
    set status = p_status,
        resolution_note = btrim(p_resolution_note),
        resolved_by = auth.uid(),
        resolved_at = now()
    where id = p_issue_id
    returning id into updated_issue_id;
  end if;

  if updated_issue_id is null then
    raise no_data_found using message = 'The source alert was not found';
  end if;

  return updated_issue_id;
end;
$$;

revoke all on function public.resolve_reference_entry_issue(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_reference_entry_issue(uuid, text, text) to authenticated;

comment on function public.resolve_reference_entry_issue(uuid, text, text)
is 'Lets active catalog administrators record a decision on an imported source alert without changing source facts.';
