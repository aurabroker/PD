/**
 * Przeplyw end-to-end na realnej bazie:
 * import pliku -> zapis wniosku -> odczyt -> eksport .xlsx -> usuniecie danych testowych.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { wczytajWniosekZExcela } = await import("../src/lib/excel/parse");
  const { zbudujExcelWniosku } = await import("../src/lib/excel/build");
  const { utworzWniosek, pobierzWniosek, zapiszWniosek } = await import("../src/lib/wnioski");
  const { supabaseAdmin } = await import("../src/lib/supabase/admin");
  const { sumaWniosku } = await import("../src/lib/schema");

  const buf = readFileSync(process.argv[2]);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

  console.log("1. Import pliku…");
  const { dane, ostrzezenia } = await wczytajWniosekZExcela(ab);
  // Oznaczamy rekord, zeby dalo sie go rozpoznac i usunac.
  dane.nazwa_firmy = `[TEST AUTOMATYCZNY] ${dane.nazwa_firmy}`;
  console.log(`   odczytano ${dane.lokalizacje.length} lok., ${ostrzezenia.length} ostrzeżeń`);

  console.log("2. Zapis do bazy…");
  const utworzony = await utworzWniosek(dane, { zrodlo: "excel", nazwaPliku: "test.xlsx" });
  console.log(`   utworzono ${utworzony.nr_referencyjny} (token ${utworzony.form_token.slice(0, 12)}…)`);

  console.log("3. Odczyt z bazy…");
  const odczytany = await pobierzWniosek(utworzony.form_token);
  if (!odczytany) throw new Error("Nie odczytano wniosku");
  console.log(`   lokalizacje: ${odczytany.dane.lokalizacje.length}`);
  console.log(`   sprzet med: ${odczytany.dane.sprzet_medyczny.length}, eei: ${odczytany.dane.elektronika_eei.length}`);
  console.log(`   szkody: ${odczytany.dane.szkody.length}, zakres: ${odczytany.dane.zakres.length} poz.`);
  console.log(`   suma z bazy: ${sumaWniosku(odczytany.dane)} (przed zapisem: ${sumaWniosku(dane)})`);

  const zgodne =
    sumaWniosku(odczytany.dane) === sumaWniosku(dane) &&
    odczytany.dane.lokalizacje.length === dane.lokalizacje.length &&
    odczytany.dane.sprzet_medyczny.length === dane.sprzet_medyczny.length &&
    odczytany.dane.elektronika_eei.length === dane.elektronika_eei.length &&
    odczytany.dane.szkody.length === dane.szkody.length &&
    odczytany.dane.zakres.length === dane.zakres.length;
  console.log(`   ZGODNOŚĆ PO ZAPISIE: ${zgodne ? "OK" : "ROZBIEŻNOŚĆ"}`);

  console.log("4. Zapis roboczy (edycja)…");
  odczytany.dane.uwagi = "Notatka dopisana przez test.";
  await zapiszWniosek(utworzony.form_token, odczytany.dane);
  const poEdycji = await pobierzWniosek(utworzony.form_token);
  console.log(`   uwagi po edycji: ${JSON.stringify(poEdycji?.dane.uwagi)}`);

  console.log("5. Eksport .xlsx…");
  const plik = await zbudujExcelWniosku(odczytany.dane, { nrReferencyjny: utworzony.nr_referencyjny });
  writeFileSync("/tmp/claude-0/-home-user-PD/ed4f084e-10ce-5166-8c73-20e3293f78bd/scratchpad/z-bazy.xlsx", plik);
  console.log(`   wygenerowano ${plik.length} bajtów`);

  console.log("6. Sprzątanie…");
  const supabase = supabaseAdmin();
  await supabase.from("mienie_lokalizacje").delete().eq("wniosek_id", utworzony.id);
  const { error } = await supabase.from("mienie_wnioski").delete().eq("id", utworzony.id);
  console.log(error ? `   BŁĄD: ${error.message}` : "   dane testowe usunięte");

  const { count } = await supabase
    .from("mienie_wnioski")
    .select("id", { count: "exact", head: true });
  console.log(`   wniosków w bazie po sprzątaniu: ${count}`);
}

main().catch((e) => {
  console.error("BŁĄD:", e.message);
  process.exit(1);
});
