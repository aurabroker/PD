-- ================================================================
-- COFNIECIE migracji 20260922_mienie_rls_lockdown.sql
-- ================================================================
--
-- URUCHOM TYLKO wtedy, gdy okaze sie, ze jakas starsza aplikacja pisala do
-- `mienie_wnioski` kluczem `anon` i po lockdownie przestala dzialac.
--
-- UWAGA: ten plik PRZYWRACA DZIURE. Po jego wykonaniu kazdy z publicznym
-- kluczem anon znow moze czytac i nadpisywac wszystkie wnioski razem
-- z danymi osobowymi klientow. Traktuj to jako rozwiazanie awaryjne
-- na czas przepiecia tamtej aplikacji na service_role, nie jako stan docelowy.
--
-- ================================================================

begin;

drop policy if exists mienie_wnioski_admin on public.mienie_wnioski;
drop policy if exists mienie_wnioski_wlasciciel on public.mienie_wnioski;
drop policy if exists mienie_lokalizacje_admin on public.mienie_lokalizacje;
drop policy if exists mienie_lokalizacje_wlasciciel on public.mienie_lokalizacje;

-- Stan sprzed lockdownu, odtworzony 1:1 ze snapshotu pg_policies.
create policy mienie_all_authenticated on public.mienie_wnioski
  for all to authenticated using (true) with check (true);
create policy mienie_select_anon on public.mienie_wnioski
  for select to anon using (true);
create policy mienie_insert_anon on public.mienie_wnioski
  for insert to anon with check (true);
create policy mienie_update_anon on public.mienie_wnioski
  for update to anon using (true) with check (true);
create policy mienie_wnioski_read_anon on public.mienie_wnioski
  for select to anon using (true);

create policy auth_all_lokalizacje on public.mienie_lokalizacje
  for all to authenticated using (true) with check (true);
create policy anon_all_lokalizacje on public.mienie_lokalizacje
  for all to anon using (true) with check (true);
create policy mienie_lokalizacje_read_anon on public.mienie_lokalizacje
  for select to anon using (true);

commit;
