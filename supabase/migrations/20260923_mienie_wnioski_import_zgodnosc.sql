-- Wynik porownania zaczytanego pliku .xlsx z oryginalnym szablonem.
-- {"zgodny": bool, "roznice": [tekst, ...], "liczba": int} albo NULL
-- (wniosek z formularza www albo import sprzed wprowadzenia kontroli).
-- Czyta tylko panel agenta; RLS bez zmian (anon nie ma dostepu do tabeli).
alter table public.mienie_wnioski
  add column if not exists import_zgodnosc jsonb;

comment on column public.mienie_wnioski.import_zgodnosc is
  'Porownanie zaczytanego pliku z oryginalnym szablonem: {zgodny, roznice[], liczba}. NULL dla wnioskow bez importu.';
