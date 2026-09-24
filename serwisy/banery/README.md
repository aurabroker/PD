# banery — wspólne grafiki utratadochodu.pl

Worker Cloudflare serwujący grafiki. Z grafik korzystają
formularz wniosków, serwisy branżowe i maile.

- Adres: `https://banery.auraexpert.pl/banery/<nazwa>.png` (Custom Domain workera `banery`)
- Lista: `https://banery.auraexpert.pl/banery/index.json`
- Zapasowo: `https://banery.aurabroker.workers.dev/banery/<nazwa>.png`
- Stare adresy `ergo.auraexpert.pl/banery/*` zadziałają po dodaniu trasy
  `ergo.auraexpert.pl/banery/*` → `banery` (Cloudflare → auraexpert.pl → Workers Routes).
- Format: PNG 1200×628. Grafiki wbudowane w worker (`src/banery/`), nagłówki (cache na dobę, CORS, CORP cross-origin) w `src/index.js`.

Nowy baner: dodaj plik do `src/banery/`, import w `src/index.js`, dopisz go w `index.json`, potem
`cd serwisy/banery && npx wrangler deploy`. Grafiki z przeglądarki blokery reklam mogą ukrywać (ścieżka `/banery/`) — na stronach lepiej podawać je przez własną domenę serwisu (jak `/grafika/` w formularzu wniosków)..

Źródło grafik: repozytorium `branzowe`, gałąź `claude/cool-hypatia-ndksid`, `static/banery/`.
