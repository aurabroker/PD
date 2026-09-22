/**
 * Wbudowuje szablon .xlsx w kod jako base64.
 *
 * Na Cloudflare Workers nie ma systemu plikow w runtime, wiec szablonu nie da sie
 * wczytac przez `fs`. Zrodlem prawdy pozostaje plik .xlsx w `public/szablon/` -
 * ten modul jest z niego generowany i nie nalezy go edytowac recznie.
 *
 * Uruchamiane automatycznie przed kazdym buildem (skrypt `prebuild`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const zrodlo = path.join(process.cwd(), "public", "szablon", "wniosek-ubezpieczenie-majatkowe.xlsx");
const cel = path.join(process.cwd(), "src", "lib", "excel", "szablon.generated.ts");

const plik = readFileSync(zrodlo);

const modul = `// PLIK GENEROWANY — nie edytuj.
// Zrodlo: public/szablon/wniosek-ubezpieczenie-majatkowe.xlsx
// Regeneracja: npx tsx scripts/generuj-szablon.ts (albo dowolny npm run build)

/** Szablon wniosku zakodowany base64 — wbudowany w bundle, bo Workers nie maja dysku. */
export const SZABLON_XLSX_BASE64 =
  "${plik.toString("base64")}";

export const SZABLON_ROZMIAR_BAJTOW = ${plik.length};
`;

writeFileSync(cel, modul);
console.log(`Wygenerowano ${path.relative(process.cwd(), cel)} — ${plik.length} B -> ${modul.length} B`);
