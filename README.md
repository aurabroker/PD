# PD — wniosek o ubezpieczenie majątkowe salonów beauty

Aplikacja webowa do zbierania wniosków o ubezpieczenie majątkowe salonów kosmetycznych
i klinik medycyny estetycznej. Ten sam wniosek można złożyć przez formularz online albo
wczytać z wypełnionego arkusza Excel.

## Stack

| Warstwa | Wybór | Dlaczego |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript | Formularz i panel w jednym runtime; Server Actions zamiast osobnego API |
| Hosting | **Cloudflare Workers** przez `@opennextjs/cloudflare` | |
| Baza i auth | Supabase — projekt **BEAUTY** (`dhuvykwecsxgchzxufxw`) | Tabele `mienie_wnioski` / `mienie_lokalizacje` już tam były, razem z danymi |
| Formularz | react-hook-form + zod | Jeden schemat waliduje formularz i import z Excela |
| Excel | ExcelJS | Odczyt i zapis .xlsx po stronie serwera |
| UI | Tailwind CSS | |

Astro odpadło świadomie: aplikacja jest w całości interaktywna i server-side
(kreator z autozapisem, parsowanie uploadu, panel z filtrami), więc wyspy Astro
sprowadziłyby się do Next.js okrężną drogą.

## Cloudflare Workers — co z tego wynika dla kodu

Workers nie mają systemu plików w runtime, więc **szablonu .xlsx nie da się wczytać
przez `fs`**. Źródłem prawdy pozostaje `public/szablon/wniosek-ubezpieczenie-majatkowe.xlsx`,
a skrypt `scripts/generuj-szablon.ts` koduje go do `src/lib/excel/szablon.generated.ts`
(base64, ~47 kB w bundlu). Generowanie jest wpięte **jawnie w każdą komendę build**,
a nie w hook `prebuild` — `opennextjs-cloudflare build` woła `next build` bezpośrednio,
z pominięciem hooków npm.

Kod nie używa żadnych API Node'a: `node:crypto` zastąpiony Web Crypto, `Buffer`
zastąpiony `Uint8Array`. Dzięki temu nic nie zależy od warstwy zgodności.

ExcelJS **działa** w workerd — sprawdzone na zbudowanym workerze, nie założone.
Biblioteka ciągnie `archiver`, `unzipper` i `tmp`, więc warto to potwierdzać ponownie
przy większych aktualizacjach.

Rozmiar workera: **9,8 MB surowo / 2,1 MB gzip** (`wrangler deploy --dry-run`).
Projekt działa na płatnym planie Workers, gdzie limit wynosi 10 MB gzip —
zapasu jest więc z nadmiarem. Warto mimo to zerkać na ten wynik przy
dokładaniu ciężkich zależności, bo ExcelJS sam w sobie waży sporo.

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

- **Agent** — e-mail i hasło na `/login`, plus wpis w tabeli `katalog_admins`.
  Samo zalogowanie nie wystarcza: `biezacyAdmin()` sprawdza obie rzeczy.
  Świadomie bez magic linku — logowanie mailem zależy od listy Redirect URLs
  w Supabase, a hasło działa niezależnie od domeny, pod którą stoi aplikacja.
- **Klient** — link z `form_token`, ważny 60 dni; agent może przedłużyć w panelu.
  Do listy swoich wniosków klient loguje się magic linkiem na `/moje`, bez zakładania konta.

### Magic link klienta wymaga konfiguracji w Supabase

To jedyne miejsce, gdzie aplikacja zależy od ustawień Auth. W Supabase →
**Authentication → URL Configuration → Redirect URLs** musi być dopisany
dokładny adres:

```
https://<domena-aplikacji>/auth/callback
```

Gdy go tam nie ma, Supabase **nie zgłasza błędu** — po cichu podstawia
**Site URL** projektu i klient po kliknięciu w link ląduje na zupełnie innej
domenie. Adres powrotu można wymusić zmienną `NEXT_PUBLIC_ADRES_APLIKACJI`;
puste pole oznacza „użyj bieżącego origin".

Dostęp do danych idzie przez Server Actions z kluczem `service_role`, który omija RLS.
Klucz nigdy nie trafia do przeglądarki. Każda akcja sama weryfikuje uprawnienie —
tokenem wniosku albo sesją agenta.

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # uzupełnij klucze z panelu Supabase (Settings → API)
npm run dev                  # Next dev, zwykły Node
```

Podgląd na prawdziwym runtime Workers i wdrożenie:

```bash
npm run cf:preview   # build + wrangler dev na zbudowanym workerze
npm run cf:deploy    # build + deploy
```

### Diagnostyka wdrożenia

`GET /api/stan` mówi, co jest nie tak, bez ujawniania wartości kluczy:

```json
{"ok":false,"etap":"zmienne srodowiskowe","brakujace":["SUPABASE_SERVICE_ROLE_KEY"]}
```

Zwraca 200 gdy wszystko działa (z liczbą wniosków w bazie), 503 przy braku
zmiennych albo problemie z połączeniem. Bez tego każdy błąd konfiguracji
wygląda w panelu Cloudflare identycznie — jako gołe 500 bez treści.

Nazwa Workera w `wrangler.jsonc` (`mienie-wnioski`) **musi się zgadzać**
z nazwą Workera w panelu Cloudflare, inaczej deploy z Git builda padnie.

Sekrety na produkcji:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Trzy różne miejsca na zmienne — łatwo pomylić

| Gdzie | Kiedy istnieje | Co tu wstawić |
|---|---|---|
| Workers Builds → **Build variables** | tylko podczas kompilacji | `NEXT_PUBLIC_*` |
| Worker → **Variables and Secrets**, typ *Variable* | w runtime, ale **kasowane przy każdym `wrangler deploy`** | nic ważnego |
| Worker → **Variables and Secrets**, typ *Secret* | w runtime, przetrwa deploy | `SUPABASE_SERVICE_ROLE_KEY` |

Zmienne `NEXT_PUBLIC_*` Next wkompilowuje w bundle podczas builda, więc wystarczą
w Build variables i **będą raportowane jako obecne nawet przy pustym runtime**.
To mylące przy diagnozie: `NEXT_PUBLIC_*` mogą pokazywać `true`, podczas gdy Worker
nie ma ani jednej zmiennej środowiskowej.

Klucz serwisowy musi być **Secretem**. Ustawiony jako zwykła Variable zniknie przy
najbliższym deployu — [dokumentacja Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth):
*„If you change your environment variables in the Cloudflare dashboard, Wrangler will
override them the next time you deploy. […] Wrangler will not delete your secrets."*

Dlatego `wrangler.jsonc` deklaruje `secrets.required` — deploy bez tego sekretu
kończy się błędem, zamiast wypuszczać na produkcję Workera, który wywróci się
przy pierwszym zapisie.

**Sekret runtime — dwie drogi, obie sprawdzone:**

1. **Przez Workers Builds** (nic nie trzeba robić poza ustawieniem zmiennej).
   Ustaw `SUPABASE_SERVICE_ROLE_KEY` w Settings → Build → Build variables and
   secrets, a **deploy command** ustaw na `npm run cf:deploy:ci`.
   Ten skrypt zapisuje sekret do pliku tymczasowego i wywołuje
   `wrangler deploy --secrets-file`, po czym plik kasuje.
2. **Raz, bezpośrednio na Workerze:** `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
   albo Settings → Variables and Secrets → Add → typ **Secret** → Deploy.
   Wtedy zwykłe `npx wrangler deploy` wystarczy.

**Czego nie robić i dlaczego:**

`wrangler deploy` **nie wgrywa** sekretów z `process.env`. Komunikat
`Using secrets defined in process.env` w logu dotyczy ładowania zmiennych,
nie przesyłania sekretów — łatwo go błędnie odczytać. Sekret trafia na Workera
wyłącznie przez `wrangler secret put` albo `--secrets-file`. Sama obecność
zmiennej w środowisku builda nic nie daje.

Nie ustawiaj go też jako zwykłej *Variable* na Workerze — zniknie
przy najbliższym deployu.

Stan zmiennych na żywym Workerze sprawdzisz bez wchodzenia w panel:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/scripts/mienie-wnioski/secrets" \
  -H "Authorization: Bearer <TOKEN>"
```

`SUPABASE_SERVICE_ROLE_KEY` pobierz z panelu Supabase. Nie może mieć prefiksu
`NEXT_PUBLIC_` — z takim trafiłby do bundla przeglądarki.

Konto agenta zakłada administrator w Supabase → **Authentication → Users → Add user**
(e-mail + hasło, zaznacz „Auto Confirm User"). Następnie nadaj mu dostęp do panelu:

```sql
insert into public.katalog_admins (user_id)
select id from auth.users where email = 'adres@aura-expert.pl';
```

Bez tego wpisu poprawnie zalogowany użytkownik i tak zostanie odrzucony przez
`/admin` — tak działa `biezacyAdmin()` i tak samo zachowują się polityki RLS.

## Testy

**End-to-end formularza** — `tests/e2e/`, instrukcja w `tests/e2e/README.md`.
13 scenariuszy w prawdziwej przeglądarce, na tym samym runtime co produkcja (workerd)
i na bazie ze schematem 1:1 z BEAUTY. Sprawdza m.in. autozapis niekompletnego wniosku,
wyścig zapisów z dwóch kart, usuwanie lokalizacji, datę wpisaną ręcznie jak w Safari,
utratę zasięgu i widok na telefonie. **Uruchamiaj przed każdym wdrożeniem zmian
w formularzu.**

Testy jednostkowe importu i eksportu Excela:

```bash
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/test-import.ts <plik.xlsx>
NODE_OPTIONS='--conditions=react-server' npx tsx scripts/test-roundtrip.ts <plik.xlsx>
```

`test-roundtrip` sprawdza, że import → eksport → ponowny import nie gubi danych.

## Stan bazy

Obie migracje są **zastosowane** na projekcie BEAUTY:

- `20260922_mienie_wnioski_workflow_columns.sql` — kolumny obiegu wniosku
- `20260922_mienie_rls_lockdown.sql` — zamknięcie dostępu roli `anon`

### Model dostępu po lockdownie

| Kto | Dostęp |
|---|---|
| `anon` (klucz publiczny) | **brak** — żadnej polityki |
| `service_role` (Server Actions) | pełny, omija RLS; każda akcja sama sprawdza uprawnienie |
| agent zalogowany | pełny, ale tylko przy wpisie w `katalog_admins` |
| klient zalogowany magic linkiem | odczyt wyłącznie własnych wniosków (po e-mailu z tokenu) |
| klient z linkiem, bez logowania | przez `service_role` po weryfikacji `form_token` |

Zweryfikowane wykonaniem zapytań **w roli `anon`**, nie samym odczytem `pg_policies`:
odczyt zwraca 0 z 2 wierszy, insert odrzucony przez RLS, update obejmuje 0 wierszy.
Tabele zniknęły też z listy ostrzeżeń Supabase Advisors.

Gdyby okazało się, że jakaś starsza aplikacja pisała kluczem `anon` i przestała działać,
jest `20260922_mienie_rls_lockdown_ROLLBACK.sql` — ale przywraca on dziurę, więc nadaje się
tylko na czas przepięcia tamtej aplikacji na `service_role`.

### Znalezione przy okazji, poza zakresem tej aplikacji

Supabase Advisors zgłasza dla projektu BEAUTY rzeczy niezwiązane z wnioskami majątkowymi,
dotyczące modułu katalogu salonów. Nie ruszałem ich:

- trzy widoki `public_catalog_*` / `public_salon_reviews` z `SECURITY DEFINER` (poziom ERROR)
- `salon_search_index` — widok zmaterializowany czytelny dla `anon`
- `tax_wnioski` — RLS włączone, zero polityk (czyli tabela zamknięta, nie otwarta)
- rozszerzenia `citext`, `unaccent`, `pg_trgm` w schemacie `public`

Funkcja `katalog_set_admin` też się tam pojawia, ale sprawdziłem jej treść — ma
wewnętrzny `if not is_katalog_admin() then raise exception 'forbidden'`, więc nie da się
przez nią nadać sobie uprawnień. To istotne, bo polityka admina dla wniosków opiera się
właśnie na `katalog_admins`.

## Czego nie ma w szablonie Excel

Baza przewiduje kolumnę `zabiegi` (lista wykonywanych zabiegów), a arkusz jej nie zbiera.
W formularzu pole również jest na razie puste — do uzupełnienia, gdy ustalicie listę
zabiegów istotnych dla oceny ryzyka.
