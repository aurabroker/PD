/**
 * Wbudowuje szablon .xlsx w kod jako base64.
 *
 * Na Cloudflare Workers nie ma systemu plikow w runtime, wiec szablonu nie da sie
 * wczytac przez `fs`. Zrodlem prawdy pozostaje plik .xlsx w `public/szablon/` -
 * ten modul jest z niego generowany i nie nalezy go edytowac recznie.
 *
 * Uruchamiane automatycznie przed kazdym buildem (skrypt `prebuild`).
 */
import { execSync } from "node:child_process";
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

// --- Znacznik wersji ---
//
// Identyfikator wersji Workera w panelu Cloudflare nie mowi nic o tym, ktory
// commit jest wdrozony. Bez tego znacznika kazde pytanie "czy poprawka juz
// dziala" konczy sie zgadywaniem. /api/stan raportuje te wartosci.

function commit(): string {
  // Workers Builds wstrzykuje SHA samo; przy deployu z CLI bierzemy je z gita.
  const zCi = process.env.WORKERS_CI_COMMIT_SHA;
  if (zCi) return zCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "nieznany";
  }
}

const celWersji = path.join(process.cwd(), "src", "lib", "wersja.generated.ts");
const znacznik = `// PLIK GENEROWANY - nie edytuj. Zrodlo: scripts/generuj-szablon.ts

export const WERSJA = {
  commit: "${commit()}",
  galaz: "${process.env.WORKERS_CI_BRANCH ?? ""}",
  zbudowano: "${new Date().toISOString()}",
} as const;
`;

writeFileSync(celWersji, znacznik);
console.log(`Znacznik wersji: commit ${commit()}`);
