/** Import -> eksport -> ponowny import. Sprawdza, ze plik z systemu nie gubi danych. */
import { readFileSync, writeFileSync } from "node:fs";
import { wczytajWniosekZExcela } from "../src/lib/excel/parse";
import { zbudujExcelWniosku } from "../src/lib/excel/build";
import { sumaWniosku } from "../src/lib/schema";

async function main() {
  const buf = readFileSync(process.argv[2]);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

  const pierwszy = await wczytajWniosekZExcela(ab);
  const wygenerowany = await zbudujExcelWniosku(pierwszy.dane, { nrReferencyjny: "MIE-202609-TEST01" });
  writeFileSync("/tmp/claude-0/-home-user-PD/ed4f084e-10ce-5166-8c73-20e3293f78bd/scratchpad/roundtrip.xlsx", wygenerowany);

  const drugi = await wczytajWniosekZExcela(
    wygenerowany.buffer.slice(
      wygenerowany.byteOffset,
      wygenerowany.byteOffset + wygenerowany.byteLength,
    ) as ArrayBuffer,
  );

  const roznice: string[] = [];
  const a = JSON.parse(JSON.stringify(pierwszy.dane));
  const b = JSON.parse(JSON.stringify(drugi.dane));

  for (const klucz of Object.keys(a)) {
    const x = JSON.stringify(a[klucz]);
    const y = JSON.stringify(b[klucz]);
    if (x !== y) roznice.push(`${klucz}:\n    przed: ${x}\n    po:    ${y}`);
  }

  console.log("suma przed:", sumaWniosku(pierwszy.dane), "| po:", sumaWniosku(drugi.dane));
  console.log("lokalizacje:", pierwszy.dane.lokalizacje.length, "->", drugi.dane.lokalizacje.length);
  console.log("sprzet med:", pierwszy.dane.sprzet_medyczny.length, "->", drugi.dane.sprzet_medyczny.length);
  console.log("eei:", pierwszy.dane.elektronika_eei.length, "->", drugi.dane.elektronika_eei.length);
  console.log("szkody:", pierwszy.dane.szkody.length, "->", drugi.dane.szkody.length);
  console.log("\nRÓŻNICE:", roznice.length === 0 ? "brak" : "");
  for (const r of roznice) console.log(" -", r);
  console.log("\nostrzeżenia przy ponownym imporcie:", drugi.ostrzezenia.length);
  for (const o of drugi.ostrzezenia) console.log("   ", o.arkusz, "|", o.opis);
}
main();
