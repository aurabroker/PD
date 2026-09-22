/** Kontrola importu na realnym pliku szablonu. Uruchomienie: npx tsx scripts/test-import.ts <plik.xlsx> */
import { readFileSync } from "node:fs";
import { wczytajWniosekZExcela } from "../src/lib/excel/parse";
import { kontrolaSpojnosci, sumaWniosku } from "../src/lib/schema";

const sciezka = process.argv[2];
if (!sciezka) {
  console.error("Podaj ścieżkę do pliku .xlsx");
  process.exit(1);
}

async function main() {
const buf = readFileSync(sciezka);
const { dane, ostrzezenia } = await wczytajWniosekZExcela(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
);

console.log("=== DANE FIRMY ===");
console.log({
  nazwa_firmy: dane.nazwa_firmy,
  nip: dane.nip,
  email: dane.email_kontaktowy,
  telefon: dane.telefon,
  forma_prawna: dane.forma_prawna,
  rodzaj: dane.rodzaj_dzialalnosci,
  pracownicy: dane.liczba_pracownikow,
});
console.log("\n=== LOKALIZACJE:", dane.lokalizacje.length, "===");
for (const l of dane.lokalizacje) {
  console.log(`#${l.nr} adres=${JSON.stringify(l.adres)} typ=${JSON.stringify(l.typ_lokalu)} pow=${l.powierzchnia} alarm=${JSON.stringify(l.alarm_typ)} cctv=${l.cctv} sumy=${l.suma_budynek}/${l.suma_wyposazenie}/${l.suma_sprzet_medyczny}`);
}
console.log("\n=== ZAKRES ===", dane.zakres);
console.log("=== SPRZĘT MED ===", dane.sprzet_medyczny.length, "poz.");
console.log("=== EEI ===", dane.elektronika_eei.length, "poz.");
console.log("=== SZKODY === brak_szkod:", dane.brak_szkod, "| pozycji:", dane.szkody.length);
console.log("=== POLISA === posiada:", dane.posiada_polise, dane.towarzystwo_obecne);
console.log("=== SUMA ŁĄCZNIE ===", sumaWniosku(dane));
console.log("\n=== KONTROLA SPÓJNOŚCI ===");
console.table(kontrolaSpojnosci(dane));
console.log("\n=== OSTRZEŻENIA ===", ostrzezenia.length);
for (const o of ostrzezenia) console.log(` - [${o.arkusz}] ${o.opis}`);
}

main();
