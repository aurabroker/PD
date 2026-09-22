/**
 * Zapisuje sekrety ze srodowiska builda do pliku dla `wrangler deploy --secrets-file`.
 *
 * Dlaczego to jest potrzebne: `wrangler deploy` NIE wgrywa sekretow z process.env.
 * Komunikat "Using secrets defined in process.env" dotyczy ladowania zmiennych,
 * nie przesylania sekretow na Workera. Sekret trafia na Workera wylacznie przez
 * `wrangler secret put` albo przez ten plik.
 *
 * Plik jest tymczasowy, powstaje wylacznie w srodowisku builda i jest kasowany
 * zaraz po deployu. Nie moze trafic do repozytorium - jest w .gitignore.
 */
import { writeFileSync } from "node:fs";

const WYMAGANE = ["SUPABASE_SERVICE_ROLE_KEY"];
const SCIEZKA = ".wrangler-sekrety.json";

const sekrety = {};
const brakujace = [];

for (const nazwa of WYMAGANE) {
  const wartosc = process.env[nazwa]?.trim();
  if (wartosc) sekrety[nazwa] = wartosc;
  else brakujace.push(nazwa);
}

if (brakujace.length > 0) {
  console.error(
    `\nBLAD: brak sekretow w srodowisku builda: ${brakujace.join(", ")}.\n` +
      "Ustaw je w Workers Builds -> Settings -> Build -> Build variables and secrets\n" +
      "albo bezposrednio na Workerze przez `wrangler secret put`.\n",
  );
  process.exit(1);
}

writeFileSync(SCIEZKA, JSON.stringify(sekrety));
// Same nazwy, nigdy wartosci.
console.log(`Sekrety przygotowane do wgrania: ${Object.keys(sekrety).join(", ")}`);
