-- Replika schematu produkcyjnego BEAUTY (mienie_wnioski, mienie_lokalizacje),
-- odtworzona z information_schema/pg_constraint/pg_indexes z 2026-09-23.
create extension if not exists pgcrypto;

create table public.crm_companies (id serial primary key, nazwa text);

create table public.mienie_wnioski (
  id uuid primary key default gen_random_uuid(),
  company_id integer references public.crm_companies(id) on delete set null,
  form_token text not null,
  nazwa_firmy text not null default '',
  nip text default '', regon text default '', krs text default '',
  adres_siedziby text default '', forma_prawna text default '', numer_pkd text default '',
  email_kontaktowy text default '', telefon text default '',
  osoba_kontaktu text default '', stanowisko text default '',
  adres_lokalizacji text default '', typ_lokalu text default '', pietro text default '',
  powierzchnia numeric,
  rok_budowy text default '', rok_remontu text default '',
  budynek_wlasny boolean default false,
  material_scian text default '', pokrycie_dachu text default '',
  stan_techniczny text default '', ogrzewanie text default '',
  materialy_palne boolean default false,
  rodzaj_dzialalnosci text default '', liczba_pracownikow text default '', roczny_obrot text default '',
  zabiegi jsonb default '[]'::jsonb,
  gasnice_szt text default '', hydranty boolean default false, data_przegladu_gasnic text default '',
  sap boolean default false, tryskacze boolean default false, drogi_ewakuacyjne boolean default false,
  odleglosc_psp text default '', zakaz_palenia boolean default false,
  alarm_typ text default 'brak', ogrodzenie boolean default false, agencja_ochrony text default '',
  agencja_24h boolean default false, cctv boolean default false, kraty boolean default false,
  rolety boolean default false, zamki_atestowane boolean default false, drzwi_atestowane boolean default false,
  szyby_antywlamaniowe boolean default false, sejf_klasa text default 'brak', system_alarmowy boolean default false,
  zakres jsonb default '[]'::jsonb,
  suma_budynek numeric default 0, suma_wyposazenie numeric default 0, suma_maszyny numeric default 0,
  suma_srodki_obrotowe numeric default 0, suma_elektronika_it numeric default 0,
  suma_sprzet_medyczny numeric default 0, suma_gotowka_lokal numeric default 0,
  suma_gotowka_transport numeric default 0, suma_szyby numeric default 0, suma_mienie_pracownikow numeric default 0,
  suma_lacznie numeric generated always as (
    coalesce(suma_budynek,0) + coalesce(suma_wyposazenie,0) + coalesce(suma_maszyny,0)
    + coalesce(suma_srodki_obrotowe,0) + coalesce(suma_elektronika_it,0) + coalesce(suma_sprzet_medyczny,0)
    + coalesce(suma_gotowka_lokal,0) + coalesce(suma_gotowka_transport,0) + coalesce(suma_szyby,0)
    + coalesce(suma_mienie_pracownikow,0)) stored,
  brak_szkod boolean default true, szkody jsonb default '[]'::jsonb,
  posiada_polise boolean default false, towarzystwo_obecne text default '',
  nr_polisy_obecny text default '', waznosc_do text default '', roczna_skladka_obecna numeric,
  uwagi text default '', zgoda_prawdziwosc boolean default false, zgoda_rodo boolean default false,
  sprzet_medyczny jsonb default '[]'::jsonb, elektronika_eei jsonb default '[]'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  nr_referencyjny text not null default ('MIE-' || to_char(now(),'YYYYMM') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
  status text not null default 'roboczy'
    check (status in ('roboczy','zlozony','w_ocenie','wyceniony','zaakceptowany','odrzucony','archiwalny')),
  zrodlo text not null default 'web' check (zrodlo in ('web','excel','agent')),
  wyslano_at timestamptz, miejscowosc_podpisu text default '', data_podpisu date,
  uwagi_agenta text default '', import_plik text, import_zgodnosc jsonb, token_wygasa timestamptz
);
create index idx_mienie_wnioski_company_id on public.mienie_wnioski (company_id);
create index idx_mienie_wnioski_form_token on public.mienie_wnioski (form_token);
create index mienie_wnioski_email_idx on public.mienie_wnioski (lower(email_kontaktowy));
create unique index mienie_wnioski_form_token_key on public.mienie_wnioski (form_token);
create unique index mienie_wnioski_nr_referencyjny_key on public.mienie_wnioski (nr_referencyjny);
create index mienie_wnioski_status_idx on public.mienie_wnioski (status, created_at desc);

create table public.mienie_lokalizacje (
  id uuid primary key default gen_random_uuid(),
  wniosek_id uuid not null references public.mienie_wnioski(id) on delete cascade,
  company_id integer references public.crm_companies(id),
  form_token text, nr integer not null default 1, nazwa text default 'Lokalizacja 1',
  adres text, typ_lokalu text, pietro text, powierzchnia numeric, rok_budowy text, rok_remontu text,
  budynek_wlasny boolean default false, material_scian text, pokrycie_dachu text, stan_techniczny text,
  ogrzewanie text, materialy_palne boolean default false, gasnice_szt text, hydranty boolean default false,
  data_przegladu_gasnic text, sap boolean default false, tryskacze boolean default false,
  drogi_ewakuacyjne boolean default false, odleglosc_psp text, zakaz_palenia boolean default false,
  alarm_typ text, ogrodzenie boolean default false, agencja_ochrony text, agencja_24h boolean default false,
  cctv boolean default false, kraty boolean default false, rolety boolean default false,
  zamki_atestowane boolean default false, drzwi_atestowane boolean default false,
  szyby_antywlamaniowe boolean default false, sejf_klasa text, system_alarmowy boolean default false,
  suma_budynek numeric default 0, suma_wyposazenie numeric default 0, suma_maszyny numeric default 0,
  suma_srodki_obrotowe numeric default 0, suma_elektronika_it numeric default 0,
  suma_sprzet_medyczny numeric default 0, suma_gotowka_lokal numeric default 0,
  suma_gotowka_transport numeric default 0, suma_szyby numeric default 0,
  suma_mienie_pracownikow numeric default 0, suma_lacznie numeric default 0,
  sprzet_medyczny jsonb default '[]'::jsonb, elektronika_eei jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index mienie_lokalizacje_wniosek_idx on public.mienie_lokalizacje (wniosek_id, nr);

create table public.katalog_admins (user_id uuid primary key, created_at timestamptz not null default now());

-- Role jak w Supabase
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'authenticator' noinherit;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- RLS jak na produkcji po lockdownie: anon nie ma zadnej polityki
alter table public.mienie_wnioski enable row level security;
alter table public.mienie_lokalizacje enable row level security;

-- Dodane 2026-09-23 (tez na produkcji): jedna lokalizacja o danym numerze w obrebie wniosku.
create unique index mienie_lokalizacje_wniosek_nr_key on public.mienie_lokalizacje (wniosek_id, nr);
