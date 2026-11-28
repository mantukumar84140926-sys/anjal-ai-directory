-- Keep internal discovery run metrics inaccessible to browser roles.
drop policy if exists "No public access to discovery run logs" on public.ai_tool_discovery_runs;
create policy "No public access to discovery run logs"
  on public.ai_tool_discovery_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);
