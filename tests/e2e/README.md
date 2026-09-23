# Test end-to-end formularza

Przeklikuje formularz w prawdziwej przeglądarce i sprawdza wynik bezpośrednio w bazie.
Aplikacja działa na **tym samym runtime co produkcja** (workerd, build OpenNext),
a baza ma **schemat 1:1 z projektem BEAUTY** — łącznie z kolumną generowaną
`suma_lacznie`, ograniczeniami CHECK, unikalnymi indeksami i RLS bez polityk dla `anon`.

```
Chromium (Playwright) → Worker (wrangler dev) → proxy /rest/v1 → PostgREST → Postgres 16
```

## Scenariusze

| | Co sprawdza |
|---|---|
| T1 | pełna ścieżka: 2 lokalizacje, sprzęt, szkody, polisa, odświeżenie w trakcie, złożenie, pobranie .xlsx |
| T2 | autozapis wniosku z samą nazwą firmy |
| T3 | błędny NIP nie blokuje zapisu reszty danych |
| T4 | złożenie pustego wniosku — komunikaty i przejście do pola z błędem |
| T5 | wyścig zapisów w jednej karcie |
| T6 | usunięcie środkowej lokalizacji — przenumerowanie i przepięcie sprzętu |
| T7 | import Excela przez stronę i złożenie |
| T8 | ujemna kwota, ogromna kwota, długi tekst |
| T9 | telefon 390×844 — złożenie i brak poziomego przewijania |
| T10 | import z wartościami spoza list i brakiem e-maila |
| T11 | ten sam wniosek w dwóch kartach naraz |
| T12 | data wpisana ręcznie jak w Safari (`23.09.2026`, `jutro`) |
| T13 | utrata zasięgu w trakcie wypełniania i powrót |
| T14 | import złośliwych plików: bomby dekompresyjne, XXE/billion laughs, makra i obiekty OLE, formuły w treści, podmienione rozszerzenie, uszkodzone i za duże archiwum |
| T15 | weryfikacja firmy w REGON: przycisk → akcja → wynik lub czytelny błąd, bez awarii formularza |
| T16 | przerobiony szablon (podmieniona etykieta, formuła z linkiem, ukryta treść): import przechodzi, w bazie 3 różnice dla agenta |

Korpus złośliwych plików do T14 generuje `tests/e2e/generuj-zlosliwe.mjs`
(bez zależności, sam z szablonu i wypełnionego wniosku). Można go uruchomić
też ręcznie: `node tests/e2e/generuj-zlosliwe.mjs <katalog>`.

Każdy scenariusz dodatkowo nie przechodzi, gdy pojawi się jakikolwiek wyjątek JS,
błąd w konsoli albo odpowiedź 4xx/5xx.

## Uruchomienie

Wymagane: Postgres 16, [PostgREST](https://github.com/PostgREST/postgrest/releases) 12,
Node 22, Playwright z Chromium.

```bash
# 1. Baza (Postgres na porcie 54322)
createdb -h 127.0.0.1 -p 54322 -U postgres beauty
psql -h 127.0.0.1 -p 54322 -U postgres -d beauty -f tests/e2e/replika-schemat.sql

# 2. PostgREST i proxy udające adres Supabase
postgrest tests/e2e/postgrest.conf &
node tests/e2e/proxy-supabase.mjs &

# 3. Aplikacja podpięta pod replikę
cp .env.local .env.local.kopia
node tests/e2e/klucze-jwt.mjs > .env.local
set -a; source .env.local; set +a
npm run cf:build
npx wrangler dev --port 8800 --local &

# 4. Test
npm i --no-save playwright
node tests/e2e/formularz.test.mjs            # wszystkie
TYLKO=T1,T6 node tests/e2e/formularz.test.mjs # wybrane

# 5. Przywrócenie konfiguracji
mv .env.local.kopia .env.local
```

Gdy przeglądarka proxuje ruch, ustaw `NO_PROXY=127.0.0.1,localhost`.
