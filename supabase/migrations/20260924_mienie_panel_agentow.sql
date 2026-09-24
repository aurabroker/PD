-- ================================================================
-- Panel agentów: lejek sprzedaży, agenci i przydział wniosków,
-- historia zmian, dziennik wysłanych e-maili.
-- ================================================================
--
-- Wszystkie nowe tabele: RLS włączone BEZ polityk i odebrane uprawnienia
-- anon/authenticated. Panel czyta i zapisuje wyłącznie po stronie serwera
-- kluczem service_role (tak jak od lockdownu 20260922 dla wniosków).
--
-- katalog_admins zostaje bez zmian (współdzieli ją portal testowy). Bramką
-- panelu wniosków staje się mienie_agenci — obecni admini są przepisani niżej.
-- ================================================================

begin;

-- 1. Statusy: pełny lejek — złożony → w ocenie → oferta → akceptacja → polisa,
--    wyjścia: rezygnacja klienta, odrzucenie (odmowa TU / agenta), archiwum.
alter table public.mienie_wnioski drop constraint if exists mienie_wnioski_status_check;
alter table public.mienie_wnioski add constraint mienie_wnioski_status_check
  check (status = any (array[
    'roboczy', 'zlozony', 'w_ocenie', 'wyceniony', 'zaakceptowany',
    'polisa', 'rezygnacja', 'odrzucony', 'archiwalny'
  ]));

-- 2. Agenci panelu
create table if not exists public.mienie_agenci (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  imie_nazwisko text not null default '',
  rola          text not null default 'agent' check (rola in ('admin', 'agent')),
  aktywny       boolean not null default true,
  utworzyl      uuid,
  created_at    timestamptz not null default now()
);
alter table public.mienie_agenci enable row level security;
revoke all on public.mienie_agenci from anon, authenticated;

-- Obecni administratorzy z katalog_admins zachowują dostęp jako admini panelu.
insert into public.mienie_agenci (user_id, email, rola)
select ka.user_id, u.email, 'admin'
from public.katalog_admins ka
join auth.users u on u.id = ka.user_id
on conflict (user_id) do nothing;

-- 3. Wnioski: przydział, czas w statusie, oferta i polisa
alter table public.mienie_wnioski
  add column if not exists przypisany_agent    uuid references public.mienie_agenci (user_id) on delete set null,
  add column if not exists status_zmieniony_at timestamptz,
  add column if not exists oferta_towarzystwo  text,
  add column if not exists oferta_skladka      numeric check (oferta_skladka is null or oferta_skladka >= 0),
  add column if not exists polisa_numer        text,
  add column if not exists polisa_skladka      numeric check (polisa_skladka is null or polisa_skladka >= 0),
  add column if not exists polisa_od           date,
  add column if not exists polisa_do           date,
  add column if not exists rezygnacja_powod    text;

update public.mienie_wnioski
set status_zmieniony_at = coalesce(wyslano_at, updated_at, created_at)
where status_zmieniony_at is null;

create index if not exists mienie_wnioski_agent_idx  on public.mienie_wnioski (przypisany_agent);
create index if not exists mienie_wnioski_status_idx on public.mienie_wnioski (status);

-- 4. Historia wniosku (kto, co, kiedy) — audyt i czas przejścia przez lejek
create table if not exists public.mienie_historia (
  id         bigint generated always as identity primary key,
  wniosek_id uuid not null references public.mienie_wnioski (id) on delete cascade,
  kto        uuid,   -- agent; NULL = klient albo system
  zdarzenie  text not null,
  szczegoly  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mienie_historia_wniosek_idx on public.mienie_historia (wniosek_id, created_at);
alter table public.mienie_historia enable row level security;
revoke all on public.mienie_historia from anon, authenticated;

-- 5. Dziennik e-maili — Health pokazuje nieudane wysyłki
create table if not exists public.mienie_emaile (
  id         bigint generated always as identity primary key,
  wniosek_id uuid references public.mienie_wnioski (id) on delete set null,
  typ        text not null,
  do_kogo    text not null,
  status     text not null check (status in ('wyslany', 'blad')),
  blad       text,
  resend_id  text,
  created_at timestamptz not null default now()
);
create index if not exists mienie_emaile_czas_idx on public.mienie_emaile (created_at desc);
alter table public.mienie_emaile enable row level security;
revoke all on public.mienie_emaile from anon, authenticated;

commit;
