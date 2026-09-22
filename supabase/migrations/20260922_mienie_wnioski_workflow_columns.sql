-- ZASTOSOWANA 2026-09-22 na projekcie BEAUTY (dhuvykwecsxgchzxufxw).
-- Kolumny obiegu wniosku, brakujace w BEAUTY a obecne w projektowej wersji aurabroker.
-- Migracja wylacznie addytywna: nie zmienia istniejacych kolumn ani polityk.

alter table public.mienie_wnioski
  add column if not exists nr_referencyjny text,
  add column if not exists status text not null default 'roboczy',
  add column if not exists zrodlo text not null default 'web',
  add column if not exists wyslano_at timestamptz,
  add column if not exists miejscowosc_podpisu text default '',
  add column if not exists data_podpisu date,
  add column if not exists uwagi_agenta text default '',
  add column if not exists import_plik text,
  add column if not exists token_wygasa timestamptz;

alter table public.mienie_wnioski
  alter column nr_referencyjny
  set default 'MIE-' || to_char(now(), 'YYYYMM') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6));

update public.mienie_wnioski
set nr_referencyjny = 'MIE-' || to_char(created_at, 'YYYYMM') || '-' || upper(substring(id::text from 1 for 6))
where nr_referencyjny is null;

alter table public.mienie_wnioski alter column nr_referencyjny set not null;

alter table public.mienie_wnioski drop constraint if exists mienie_wnioski_status_check;
alter table public.mienie_wnioski add constraint mienie_wnioski_status_check
  check (status in ('roboczy','zlozony','w_ocenie','wyceniony','zaakceptowany','odrzucony','archiwalny'));

alter table public.mienie_wnioski drop constraint if exists mienie_wnioski_zrodlo_check;
alter table public.mienie_wnioski add constraint mienie_wnioski_zrodlo_check
  check (zrodlo in ('web','excel','agent'));

create unique index if not exists mienie_wnioski_form_token_key on public.mienie_wnioski (form_token);
create unique index if not exists mienie_wnioski_nr_referencyjny_key on public.mienie_wnioski (nr_referencyjny);
create index if not exists mienie_wnioski_status_idx on public.mienie_wnioski (status, created_at desc);
create index if not exists mienie_wnioski_email_idx on public.mienie_wnioski (lower(email_kontaktowy));
create index if not exists mienie_lokalizacje_wniosek_idx on public.mienie_lokalizacje (wniosek_id, nr);

comment on column public.mienie_wnioski.nr_referencyjny is 'Numer wniosku widoczny dla klienta i agenta: MIE-RRRRMM-XXXXXX.';
comment on column public.mienie_wnioski.status is 'Obieg wniosku: roboczy -> zlozony -> w_ocenie -> wyceniony -> zaakceptowany|odrzucony.';
comment on column public.mienie_wnioski.zrodlo is 'Kanal zlozenia: web (formularz), excel (import pliku), agent (wprowadzony recznie).';
comment on column public.mienie_wnioski.token_wygasa is 'Po tej dacie link z form_token przestaje dawac dostep do wniosku.';
