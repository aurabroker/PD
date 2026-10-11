-- Podpis wnioskodawcy złożony palcem / rysikiem / myszą przy składaniu wniosku.
--
-- Osobna tabela, a nie kolumna w mienie_wnioski: obraz i przebieg ruchu ręki
-- ważą kilkadziesiąt KB, a listy i statystyki w panelu czytają wnioski hurtem.
-- Jeden podpis na wniosek (podpis przy ponownej próbie złożenia nadpisuje).
--
-- skrot_tresci  SHA-256 treści wniosku w chwili podpisu — wiąże podpis z treścią,
-- skrot_podpisu SHA-256 obrazu PNG,
-- punkty        przebieg ruchu: kreski [[x, y, t, nacisk], ...], x/y w 0..1.
create table if not exists public.mienie_podpisy (
  wniosek_id    uuid primary key references public.mienie_wnioski (id) on delete cascade,
  png           text not null check (length(png) <= 400000),
  punkty        jsonb not null,
  proporcje     numeric not null check (proporcje > 0 and proporcje < 20),
  podpisano_at  timestamptz not null default now(),
  ip            text,
  user_agent    text,
  skrot_tresci  text not null check (skrot_tresci ~ '^[0-9a-f]{64}$'),
  skrot_podpisu text not null check (skrot_podpisu ~ '^[0-9a-f]{64}$'),
  wersja        text not null default 'v1'
);

alter table public.mienie_podpisy enable row level security;
revoke all on public.mienie_podpisy from anon, authenticated;
