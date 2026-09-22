# PD — wniosek o ubezpieczenie majątkowe salonów beauty

Aplikacja webowa do zbierania wniosków o ubezpieczenie majątkowe salonów kosmetycznych
i klinik medycyny estetycznej. Ten sam wniosek można złożyć przez formularz online albo
wczytać z wypełnionego arkusza Excel.

## Stack

| Warstwa | Wybór | Dlaczego |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript | Formularz i panel w jednym runtime; Server Actions zamiast osobnego API |
| Baza i auth | Supabase — projekt **BEAUTY** (`dhuvykwecsxgchzxufxw`) | Tabele `mienie_wnioski` / `mienie_lokalizacje` już tam były, razem z danymi |
| Formularz | react-hook-form + zod | Jeden schemat waliduje formularz i import z Excela |
| Excel | ExcelJS | Odczyt i zapis .xlsx po stronie serwera |
| UI | Tailwind CSS | |

Astro odpadło świadomie: aplikacja jest w całości interaktywna i server-side
(kreator z autozapisem, parsowanie uploadu, panel z filtrami), więc wyspy Astro
sprowadziłyby się do Next.js okrężną drogą.

## Architektura

**`src/lib/schema.ts` jest źródłem prawdy.** Formularz web i importer Excela produkują
ten sam obiekt `Wniosek` i trafiają w jedną funkcję zapisu. Każda zmiana pola zaczyna się
w tym pliku — inaczej oba kanały się rozjadą.

```
src/lib/
  schema.ts      zod: definicja wniosku, walidacja robocza i przy złożeniu, sumy, kontrola spójności
  slowniki.ts    listy rozwijane przepisane 1:1 z arkusza `_listy`
  mapowanie.ts   Wniosek <-> wiersze Postgresa
  wnioski.ts     zapis, odczyt, tokeny dostępu
  autoryzacja.ts sprawdzenie admina i ważności tokenu
  excel/parse.ts import .xlsx
  excel/build.ts eksport .xlsx (wypełnia oryginalny szablon)
```

### Import i eksport Excela

Parser szuka danych **po etykiecie w kolumnie opisowej**, nie po adresie komórki. Dodanie
lub usunięcie wiersza w szablonie nie psuje importu, a pliki wypełnione na starszej wersji
szablonu nadal się wczytują. Eksport wypełnia oryginalny szablon z `public/szablon/`,
więc plik z systemu ma układ, który klient i agent już znają — i da się go ponownie
zaimportować bez straty danych.

Import **nigdy nie składa wniosku automatycznie**: tworzy wersję roboczą, pokazuje
ostrzeżenia (wartości spoza słownika, sprzeczne pola) i czeka na potwierdzenie klienta.

### Dostęp

- **Klient** — link z `form_token`, ważny 60 dni; agent może przedłużyć w panelu.
  Do listy swoich wniosków klient loguje się magic linkiem na `/moje`, bez zakładania konta.
- **Agent** — magic link na `/login`, plus wpis w tabeli `katalog_admins`.
  Samo zalogowanie nie wystarcza: `biezacyAdmin()` sprawdza obie rzeczy.

Dostęp do danych idzie przez Server Actions z kluczem `service_role`, który omija RLS.
Klucz nigdy nie trafia do przeglądarki. Każda akcja sama weryfikuje uprawnienie —
tokenem wniosku albo sesją agenta.

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # uzupełnij klucze z panelu Supabase (Settings → API)
npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` pobierz z panelu Supabase. Nie może mieć prefiksu
`NEXT_PUBLIC_` — z takim trafiłby do bundla przeglądarki.

Konto agenta: zaloguj się przez `/login`, potem dodaj swój `user_id` do `katalog_admins`:

```sql
insert into public.katalog_admins (user_id)
select id from auth.users where email = 'adres@aura-expert.pl';
```

## Testy

```bash
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/test-import.ts <plik.xlsx>
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/test-roundtrip.ts <plik.xlsx>
```

`test-roundtrip` sprawdza, że import → eksport → ponowny import nie gubi danych.

## Stan bazy

Migracja `20260922_mienie_wnioski_workflow_columns.sql` jest **zastosowana**.

`DO_ZATWIERDZENIA_20260922_rls_lockdown.sql` **czeka na decyzję**. Polityki RLS pozwalają
dziś roli `anon` czytać i nadpisywać wszystkie wnioski — z NIP-ami, adresami i telefonami.
Plik zamyka tę dziurę, ale najpierw trzeba ustalić, czy nie korzysta z niej wcześniejsza
aplikacja, która zapisała dwa wnioski z czerwca 2026. Szczegóły w nagłówku pliku.

## Czego nie ma w szablonie Excel

Baza przewiduje kolumnę `zabiegi` (lista wykonywanych zabiegów), a arkusz jej nie zbiera.
W formularzu pole również jest na razie puste — do uzupełnienia, gdy ustalicie listę
zabiegów istotnych dla oceny ryzyka.
