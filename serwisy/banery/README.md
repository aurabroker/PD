# banery — wspólne grafiki utratadochodu.pl

Worker Cloudflare serwujący grafiki. Z grafik korzystają
formularz wniosków, serwisy branżowe i maile.

- Adres: `https://banery.auraexpert.pl/banery/<nazwa>.jpg` (Custom Domain workera `banery`)
- Warianty: `<nazwa>.jpg` / `<nazwa>.webp` (1200×628, ~50–130 / ~25–75 KB),
  `<nazwa>-600.jpg` / `<nazwa>-600.webp` (600×314, ~20–40 KB). Do maili — JPG
  (część programów pocztowych nie obsługuje WebP).
- `<nazwa>.png` → przekierowanie 301 na `.jpg` (stare adresy działają i są lżejsze).
- Lista: `https://banery.auraexpert.pl/banery/index.json`
- Zapasowo: `https://banery.aurabroker.workers.dev/banery/<nazwa>.jpg`
- Stare adresy `ergo.auraexpert.pl/banery/*` zadziałają po dodaniu trasy
  `ergo.auraexpert.pl/banery/*` → `banery` (Cloudflare → auraexpert.pl → Workers Routes).
- Oryginały PNG (0,3–1 MB) w `oryginaly/` — nie są wdrażane. Grafiki wbudowane
  w worker (`src/banery/`), nagłówki (cache na dobę, CORS, CORP cross-origin) w `src/index.js`.

Nowy baner: oryginał do `oryginaly/`, warianty JPG/WebP 1200 i 600 px (JPG q82, WebP q80) do `src/banery/`, importy w `src/index.js`, dopisz go w `index.json`, potem
`cd serwisy/banery && npx wrangler deploy`. Grafiki z przeglądarki blokery reklam mogą ukrywać (ścieżka `/banery/`) — na stronach lepiej podawać je przez własną domenę serwisu (jak `/grafika/` w formularzu wniosków).

Źródło grafik: repozytorium `branzowe`, gałąź `claude/cool-hypatia-ndksid`, `static/banery/`.
