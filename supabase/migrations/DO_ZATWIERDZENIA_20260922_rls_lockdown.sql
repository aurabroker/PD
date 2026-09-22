-- ================================================================
-- NIE ZASTOSOWANA. Wymaga decyzji - patrz ostrzezenie ponizej.
-- ================================================================
--
-- PROBLEM
-- Polityki RLS na `mienie_wnioski` i `mienie_lokalizacje` sa otwarte dla roli `anon`
-- bez zadnego warunku:
--
--   mienie_select_anon        SELECT  anon  using (true)
--   mienie_update_anon        UPDATE  anon  using (true)
--   mienie_insert_anon        INSERT  anon
--   mienie_wnioski_read_anon  SELECT  anon  using (true)
--   anon_all_lokalizacje      ALL     anon  using (true)
--   mienie_lokalizacje_read_anon SELECT anon using (true)
--
-- Klucz `anon` jest publiczny - siedzi w kodzie kazdej strony, ktora go uzywa.
-- Kazdy, kto go ma, moze pobrac WSZYSTKIE wnioski z NIP-ami, adresami, e-mailami
-- i telefonami, a takze nadpisac dowolny cudzy wniosek. Przy danych osobowych
-- klientow to incydent RODO czekajacy na zdarzenie.
--
-- ROZWIAZANIE W TEJ APLIKACJI
-- Aplikacja nie potrzebuje dostepu `anon` do tych tabel. Caly odczyt i zapis
-- idzie przez Server Actions z kluczem service_role, ktory omija RLS, a dostep
-- klienta jest kontrolowany tokenem z linku (`lib/autoryzacja.ts`).
--
-- PRZED URUCHOMIENIEM SPRAWDZ
-- Dwa wnioski w bazie (06/2026) zapisala jakas wczesniejsza aplikacja, ktorej
-- nie ma w tym repozytorium. Jesli ta aplikacja nadal dziala i pisze do
-- `mienie_wnioski` kluczem anon, ponizsze polityki ja zatrzymaja.
-- Ustal to zanim wykonasz ten plik.
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

-- Weryfikacja po wykonaniu - lista nie powinna zawierac zadnego wiersza z rola {anon}:
-- select tablename, policyname, cmd, roles::text, qual
-- from pg_policies
-- where schemaname = 'public' and tablename in ('mienie_wnioski','mienie_lokalizacje');
