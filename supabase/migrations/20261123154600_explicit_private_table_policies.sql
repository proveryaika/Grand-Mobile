-- Explicit deny policies for tables accessed only by trusted server functions.
create policy "game logs inaccessible directly" on public.game_logs for select to authenticated using (false);
create policy "case opens inaccessible directly" on public.case_opens for select to authenticated using (false);
