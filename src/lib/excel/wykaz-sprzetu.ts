import ExcelJS from "exceljs";
import type { WniosekRoboczy } from "../schema";

/**
 * Wykaz sprzętu do zapytania ofertowego — osobny plik .xlsx dla ubezpieczyciela.
 *
 * Arkusz na kategorię (sprzęt medyczny / elektronika EEI), tylko niepuste.
 * Wartości jako liczby (ubezpieczyciel sumuje i sortuje), teksty jako komórki
 * tekstowe — „=…” z pola wniosku nie zostanie wykonane jako formuła.
 */

const NIEBIESKI = "FF00769F";
const JASNY = "FFEEF9FD";
const ZL = '#,##0" zł"';

type Naglowek = { nr: string; firma: string; nip: string; zlozono: Date | null };

function arkusz(
  wb: ExcelJS.Workbook,
  o: {
    nazwa: string;
    tytul: string;
    n: Naglowek;
    lokalizacje: WniosekRoboczy["lokalizacje"];
    ce: boolean;
    pozycje: {
      lokalizacja: number;
      nazwa: string;
      producent: string;
      model: string;
      nr_seryjny: string;
      rok_zakupu: string;
      wartosc: number;
      uwagi: string;
      cert_ce?: boolean;
    }[];
  },
) {
  const ws = wb.addWorksheet(o.nazwa, {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const kolumny = [
    { naglowek: "Lp.", szer: 5 },
    { naglowek: "Lok.", szer: 6 },
    { naglowek: "Adres lokalizacji", szer: 30 },
    { naglowek: "Nazwa urządzenia", szer: 30 },
    { naglowek: "Producent", szer: 18 },
    { naglowek: "Model", szer: 20 },
    { naglowek: "Nr seryjny", szer: 16 },
    { naglowek: "Rok zakupu", szer: 11 },
    ...(o.ce ? [{ naglowek: "Certyfikat CE", szer: 13 }] : []),
    { naglowek: "Wartość odtworzeniowa", szer: 20 },
    { naglowek: "Uwagi", szer: 30 },
  ];
  kolumny.forEach((k, i) => (ws.getColumn(i + 1).width = k.szer));
  const kolWartosc = kolumny.findIndex((k) => k.naglowek === "Wartość odtworzeniowa") + 1;

  ws.getCell("A1").value = o.tytul;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NIEBIESKI } };
  ws.getCell("A2").value = `Wniosek ${o.n.nr} · Ubezpieczający: ${o.n.firma}${o.n.nip ? ` · NIP ${o.n.nip}` : ""}`;
  ws.getCell("A3").value = o.n.zlozono
    ? `Złożony ${o.n.zlozono.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })} · wartości w pełnych złotych`
    : "Wartości w pełnych złotych";
  ws.getCell("A3").font = { color: { argb: "FF57534E" } };

  const wNaglowka = 5;
  const naglowek = ws.getRow(wNaglowka);
  kolumny.forEach((k, i) => {
    const c = naglowek.getCell(i + 1);
    c.value = k.naglowek;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NIEBIESKI } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  naglowek.height = 30;

  const adres = (nr: number) => o.lokalizacje.find((l) => l.nr === nr)?.adres ?? "";
  const posortowane = [...o.pozycje].sort((a, b) => a.lokalizacja - b.lokalizacja);
  posortowane.forEach((u, i) => {
    const rok = u.rok_zakupu.trim();
    const wiersz = ws.getRow(wNaglowka + 1 + i);
    const wartosci: (string | number)[] = [
      i + 1,
      u.lokalizacja,
      adres(u.lokalizacja),
      u.nazwa,
      u.producent,
      u.model,
      u.nr_seryjny,
      /^\d{4}$/.test(rok) ? Number(rok) : rok,
      ...(o.ce ? [u.cert_ce ? "TAK" : "NIE"] : []),
      Number(u.wartosc) || 0,
      u.uwagi,
    ];
    wartosci.forEach((v, k) => (wiersz.getCell(k + 1).value = v));
    wiersz.getCell(kolWartosc).numFmt = ZL;
    wiersz.alignment = { vertical: "top", wrapText: true };
  });

  // Podsumowanie: razem i — przy kilku lokalizacjach — suma na lokalizację.
  let w = wNaglowka + 1 + posortowane.length;
  const dopiszSume = (etykieta: string, kwota: number, gruba: boolean) => {
    const r = ws.getRow(w++);
    r.getCell(kolWartosc - 1).value = etykieta;
    r.getCell(kolWartosc - 1).alignment = { horizontal: "right" };
    r.getCell(kolWartosc).value = kwota;
    r.getCell(kolWartosc).numFmt = ZL;
    r.font = { bold: gruba };
    if (gruba) r.getCell(kolWartosc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: JASNY } };
  };
  const numery = [...new Set(posortowane.map((u) => u.lokalizacja))];
  if (numery.length > 1) {
    for (const nr of numery) {
      dopiszSume(`Lokalizacja ${nr}`, posortowane.filter((u) => u.lokalizacja === nr).reduce((a, u) => a + (Number(u.wartosc) || 0), 0), false);
    }
  }
  dopiszSume("Razem", posortowane.reduce((a, u) => a + (Number(u.wartosc) || 0), 0), true);

  ws.views = [{ state: "frozen", ySplit: wNaglowka }];
  ws.autoFilter = { from: { row: wNaglowka, column: 1 }, to: { row: wNaglowka + posortowane.length, column: kolumny.length } };
}

export async function zbudujWykazSprzetu(dane: WniosekRoboczy, n: Naglowek): Promise<Uint8Array | null> {
  if (dane.sprzet_medyczny.length === 0 && dane.elektronika_eei.length === 0) return null;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aura Expert";
  wb.created = n.zlozono ?? new Date();
  if (dane.sprzet_medyczny.length) {
    arkusz(wb, {
      nazwa: "Sprzęt medyczny",
      tytul: "Wykaz sprzętu medycznego / estetycznego",
      n,
      lokalizacje: dane.lokalizacje,
      ce: true,
      pozycje: dane.sprzet_medyczny,
    });
  }
  if (dane.elektronika_eei.length) {
    arkusz(wb, {
      nazwa: "Elektronika EEI",
      tytul: "Wykaz sprzętu elektronicznego (EEI)",
      n,
      lokalizacje: dane.lokalizacje,
      ce: false,
      pozycje: dane.elektronika_eei,
    });
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
