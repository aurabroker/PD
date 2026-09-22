/** Wypisuje payload, ktory mapowanie wysyla do Postgresa - do weryfikacji wprost w SQL. */
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const { wczytajWniosekZExcela } = await import("../src/lib/excel/parse");
  const { doWierszaWniosku, doWierszyLokalizacji } = await import("../src/lib/mapowanie");

  const buf = readFileSync(process.argv[2]);
  const { dane } = await wczytajWniosekZExcela(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );

  const wniosek = doWierszaWniosku(dane);
  const lokalizacje = doWierszyLokalizacji(
    dane,
    "00000000-0000-0000-0000-000000000001",
    null,
    "test-token",
  );

  const kat = "/tmp/claude-0/-home-user-PD/ed4f084e-10ce-5166-8c73-20e3293f78bd/scratchpad";
  writeFileSync(`${kat}/payload-wniosek.json`, JSON.stringify(wniosek));
  writeFileSync(`${kat}/payload-lokalizacje.json`, JSON.stringify(lokalizacje));

  console.log("kolumny wniosku:", Object.keys(wniosek).length);
  console.log("kolumny lokalizacji:", Object.keys(lokalizacje[0]).length, "| wierszy:", lokalizacje.length);
}
main();
