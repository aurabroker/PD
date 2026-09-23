import "server-only";
import ExcelJS from "exceljs";
import { NAGLOWEK_EKSPORTU, WZOR_NAGLOWKA_EKSPORTU, wczytajSzablon } from "./build";

/**
 * Czy wczytany plik to nasz szablon — porównanie BUDOWY pliku z oryginałem.
 *
 * Kontrola bezpieczeństwa (bezpieczenstwo.ts) odrzuca pliki groźne technicznie.
 * Ten moduł łapie coś innego: plik poprawny technicznie, ale przerobiony —
 * zmienione etykiety (dane trafiają w złe miejsca), podmienione formuły sum,
 * dodane arkusze, formuły i linki w polach, treść ukryta poza polami formularza.
 *
 * Porównujemy tylko to, czego klient nie powinien ruszać: komórki zablokowane
 * w oryginale, które mają treść (etykiety, nagłówki, formuły, listy wyboru).
 * Wartości wpisane w pola do wypełnienia (komórki odblokowane) są pomijane.
 * Wynik trafia do panelu agenta — nie blokuje importu.
 */

export type Zgodnosc = {
  zgodny: boolean;
  /** Opisy różnic, najwyżej MAX_ROZNIC. */
  roznice: string[];
  /** Łączna liczba różnic (może być większa niż długość listy). */
  liczba: number;
};

const MAX_ROZNIC = 30;

type OdciskArkusza = {
  stan: string;
  /** Adres → treść (do porównania i do pokazania) komórek zablokowanych z treścią. */
  zablokowane: Map<string, { t: string; widok: string }>;
  /** Adresy komórek odblokowanych (pola do wypełnienia). */
  odblokowane: Set<string>;
  formuly: Set<string>;
  linki: Set<string>;
};

type Odcisk = Map<string, OdciskArkusza>;

const krotko = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Formuła bez różnic zapisu między programami (Excel, LibreOffice, Google). */
const normFormula = (f: string) =>
  f.replace(/_xlfn\./gi, "").replace(/\$/g, "").replace(/\s+/g, "").toUpperCase();

function jestScalonaPodrzedna(c: ExcelJS.Cell): boolean {
  return c.type === ExcelJS.ValueType.Merge;
}

/** Treść do pokazania agentowi — formuła tak, jak jest zapisana w pliku. */
const widok = (c: ExcelJS.Cell) => (c.formula ? `=${c.formula}` : tresc(c));

/** Treść komórki do porównania; "" = pusta. */
function tresc(c: ExcelJS.Cell): string {
  if (c.formula) return `=${normFormula(c.formula)}`;
  const v = c.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
    if ("text" in v) return String(v.text).replace(/\s+/g, " ").trim();
    if ("error" in v) return String(v.error);
    return "";
  }
  return String(v).replace(/\s+/g, " ").trim();
}

function odcisk(wb: ExcelJS.Workbook): Odcisk {
  const wynik: Odcisk = new Map();
  for (const ws of wb.worksheets) {
    const a: OdciskArkusza = {
      stan: ws.state ?? "visible",
      zablokowane: new Map(),
      odblokowane: new Set(),
      formuly: new Set(),
      linki: new Set(),
    };
    ws.eachRow({ includeEmpty: true }, (row) =>
      row.eachCell({ includeEmpty: true }, (c) => {
        if (jestScalonaPodrzedna(c)) return;
        const zablokowana = c.protection?.locked !== false;
        const t = tresc(c);
        if (!zablokowana) a.odblokowane.add(c.address);
        else if (t) a.zablokowane.set(c.address, { t, widok: widok(c) });
        if (c.formula) a.formuly.add(c.address);
        if (c.hyperlink) a.linki.add(c.address);
      }),
    );
    wynik.set(ws.name.trim(), a);
  }
  return wynik;
}

let odciskOryginalu: Promise<Odcisk> | null = null;

/** Odcisk szablonu liczony raz na instancję Workera. */
function oryginal(): Promise<Odcisk> {
  odciskOryginalu ??= (async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(wczytajSzablon());
    return odcisk(wb);
  })().catch((e) => {
    odciskOryginalu = null; // nastepna proba policzy od nowa
    throw e;
  });
  return odciskOryginalu;
}

const opisStanu = (s: string) => (s === "visible" ? "widoczny" : "ukryty");

export async function zbadajZgodnosc(wb: ExcelJS.Workbook): Promise<Zgodnosc> {
  const wzor = await oryginal();
  const roznice: string[] = [];
  const dodaj = (s: string) => roznice.push(s);

  const nazwyPliku = new Set(wb.worksheets.map((ws) => ws.name.trim()));

  // Arkusze usunięte
  for (const nazwa of wzor.keys()) {
    if (!nazwyPliku.has(nazwa)) dodaj(`Brak arkusza „${nazwa}”`);
  }

  for (const ws of wb.worksheets) {
    const nazwa = ws.name.trim();
    const w = wzor.get(nazwa);
    const stan = ws.state ?? "visible";

    if (!w) {
      let komorek = 0;
      ws.eachRow((row) => row.eachCell(() => void komorek++));
      dodaj(`Dodany arkusz „${nazwa}”${stan !== "visible" ? " (ukryty)" : ""}, komórek z treścią: ${komorek}`);
      continue;
    }
    if (stan !== w.stan) dodaj(`Arkusz „${nazwa}”: ${opisStanu(w.stan)} → ${opisStanu(stan)}`);

    // Etykiety, nagłówki i formuły z oryginału muszą zostać bez zmian.
    for (const [adres, oczekiwana] of w.zablokowane) {
      const kom = ws.getCell(adres);
      if (tresc(kom) === oczekiwana.t) continue;
      // Nasz eksport wpisuje numer wniosku w podtytul — to nie jest przerobka.
      if (
        nazwa === NAGLOWEK_EKSPORTU.arkusz &&
        adres === NAGLOWEK_EKSPORTU.adres &&
        WZOR_NAGLOWKA_EKSPORTU.test(tresc(kom))
      ) {
        continue;
      }
      if (!tresc(kom)) dodaj(`„${nazwa}” ${adres}: usunięto „${krotko(oczekiwana.widok)}”`);
      else dodaj(`„${nazwa}” ${adres}: „${krotko(oczekiwana.widok, 40)}” → „${krotko(widok(kom), 40)}”`);
    }

    // Nowe formuły, linki i treść poza polami formularza.
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (c) => {
        if (jestScalonaPodrzedna(c)) return;
        const t = tresc(c);
        if (c.formula && !w.formuly.has(c.address)) {
          dodaj(`„${nazwa}” ${c.address}: dodana formuła ${krotko(widok(c))}`);
        }
        if (c.hyperlink && !w.linki.has(c.address)) {
          dodaj(`„${nazwa}” ${c.address}: link ${krotko(String(c.hyperlink))}`);
        }
        if (t && !c.formula && !w.odblokowane.has(c.address) && !w.zablokowane.has(c.address)) {
          dodaj(`„${nazwa}” ${c.address}: treść poza polami formularza „${krotko(t)}”`);
        }
      }),
    );
  }

  return {
    zgodny: roznice.length === 0,
    roznice: roznice.slice(0, MAX_ROZNIC),
    liczba: roznice.length,
  };
}
