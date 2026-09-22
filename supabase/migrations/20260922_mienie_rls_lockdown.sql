-- ================================================================
-- ZASTOSOWANA 2026-09-22 na projekcie BEAUTY (dhuvykwecsxgchzxufxw).
-- Zamkniecie dostepu roli `anon` do wnioskow majatkowych.
-- ================================================================
--
-- PROBLEM (stan przed migracja)
-- Polityki RLS byly otwarte dla roli `anon` bez zadnego warunku:
--
--   mienie_select_anon           SELECT  anon  using (true)
--   mienie_update_anon           UPDATE  anon  using (true)
--   mienie_insert_anon           INSERT  anon
--   mienie_wnioski_read_anon     SELECT  anon  using (true)
--   anon_all_lokalizacje         ALL     anon  using (true)
--   mienie_lokalizacje_read_anon SELECT  anon  using (true)
--
-- Klucz `anon` jest publiczny - siedzi w kodzie kazdej strony, ktora go uzywa.
-- Kazdy, kto go mial, mogl pobrac WSZYSTKIE wnioski z NIP-ami, adresami,
-- e-mailami i telefonami, a takze nadpisac dowolny cudzy wniosek.
--
-- PO MIGRACJI
-- Aplikacja nie potrzebuje dostepu `anon`: caly odczyt i zapis idzie przez
-- Server Actions z kluczem service_role (omija RLS), a dostep klienta
-- kontroluje token z linku (`src/lib/autoryzacja.ts`).
--
-- WERYFIKACJA (wykonana w roli anon, nie tylko odczyt pg_policies):
--   anon: odczyt mienie_wnioski        -> 0 z 2 wierszy
--   anon: odczyt mienie_lokalizacje    -> 0 wierszy
--   anon: insert                       -> odrzucony przez RLS
--   anon: update wszystkich wnioskow   -> 0 wierszy objetych
--   service_role (aplikacja)           -> 2 wiersze, bez zmian
--   authenticated spoza katalog_admins -> 0 wierszy
--
-- COFNIECIE: patrz 20260922_mienie_rls_lockdown_ROLLBACK.sql
--
-- ================================================================

begin;

drop policy if exists mienie_select_anon on public.mienie_wnioski;
drop policy if exists mienie_update_anon on public.mienie_wnioski;
drop policy if exists mienie_insert_anon on public.mienie_wnioski;
drop policy if exists mienie_wnioski_read_anon on public.mienie_wnioski;

drop policy if exists anon_all_lokalizacje on public.mienie_lokalizacje;
drop policy if exists mienie_lokalizacje_read_anon on public.mienie_lokalizacje;

-- Zalogowany agent widzi wszystko, ale tylko jesli figuruje w katalog_admins.
drop policy if exists mienie_all_authenticated on public.mienie_wnioski;
create policy mienie_wnioski_admin on public.mienie_wnioski
  for all to authenticated
  using (exists (select 1 from public.katalog_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.katalog_admins a where a.user_id = auth.uid()));

drop policy if exists auth_all_lokalizacje on public.mienie_lokalizacje;
create policy mienie_lokalizacje_admin on public.mienie_lokalizacje
  for all to authenticated
  using (exists (select 1 from public.katalog_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.katalog_admins a where a.user_id = auth.uid()));

-- Klient zalogowany magic linkiem widzi wylacznie wnioski zlozone na swoj adres.
create policy mienie_wnioski_wlasciciel on public.mienie_wnioski
  for select to authenticated
  using (lower(email_kontaktowy) = lower(auth.jwt() ->> 'email'));

create policy mienie_lokalizacje_wlasciciel on public.mienie_lokalizacje
  for select to authenticated
  using (exists (
    select 1 from public.mienie_wnioski w
    where w.id = mienie_lokalizacje.wniosek_id
      and lower(w.email_kontaktowy) = lower(auth.jwt() ->> 'email')
  ));

commit;

-- Kontrola po wykonaniu - lista nie powinna zawierac zadnego wiersza z rola {anon}:
-- select tablename, policyname, cmd, roles::text, qual
-- from pg_policies
-- where schemaname = 'public' and tablename in ('mienie_wnioski','mienie_lokalizacje');
