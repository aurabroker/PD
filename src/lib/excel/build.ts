import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Wniosek } from "../schema";
import { sumaLokalizacji } from "../schema";

/**
 * Eksport wniosku do .xlsx.
 *
 * Zamiast budowac arkusz od zera, wypelniamy oryginalny szablon - dzieki temu
 * plik wychodzacy z systemu ma dokladnie ten uklad, formatowanie i formuly,
 * ktore klient i agent juz znaja, i da sie go ponownie zaimportowac.
 */

const SZABLON = path.join(process.cwd(), "public", "szablon", "wniosek-ubezpieczenie-majatkowe.xlsx");

function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/gi, "l")
    .replace(/[*„”"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tekstKomorki(kom: ExcelJS.Cell): string {
  const v = kom.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v && v.result != null) return String(v.result);
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

function zindeksuj(ws: ExcelJS.Worksheet): Map<string, number> {
  const indeks = new Map<string, number>();
  ws.eachRow((row, nr) => {
    const etykieta = norm(tekstKomorki(row.getCell(2)));
    if (etykieta && !indeks.has(etykieta)) indeks.set(etykieta, nr);
  });
  return indeks;
}

/** Wpisuje wartosc obok etykiety. Pomija komorki z formula, zeby nie zepsuc sum. */
function ustaw(
  ws: ExcelJS.Worksheet,
  indeks: Map<string, number>,
  etykieta: string,
  wartosc: string | number | boolean | null,
) {
  const nrWiersza = indeks.get(norm(etykieta));
  if (!nrWiersza) return;

  const kom = ws.getRow(nrWiersza).getCell(3);
  if (kom.formula) return;

  if (typeof wartosc === "boolean") {
    kom.value = wartosc ? "TAK" : "NIE";
  } else if (wartosc == null || wartosc === "") {
    kom.value = null;
  } else {
    kom.value = wartosc;
  }
}

function naglowkiTabeli(ws: ExcelJS.Worksheet): { nrNaglowka: number; kolumny: Map<string, number> } {
  let nrNaglowka = 0;
  ws.eachRow((row, nr) => {
    if (!nrNaglowka && norm(tekstKomorki(row.getCell(2))) === "lp.") nrNaglowka = nr;
  });

  const kolumny = new Map<string, number>();
  if (nrNaglowka) {
    ws.getRow(nrNaglowka).eachCell((kom, nrKolumny) => {
      const nazwa = norm(tekstKomorki(kom));
      if (nazwa) kolumny.set(nazwa, nrKolumny);
    });
  }
  return { nrNaglowka, kolumny };
}

const kol = (kolumny: Map<string, number>, ...nazwy: string[]): number => {
  for (const n of nazwy) {
    const nr = kolumny.get(norm(n));
    if (nr) return nr;
  }
  return 0;
};

/** Ile wierszy tabeli ma szablon (do "RAZEM"). Nadmiar pozycji trafia do uwag. */
function pojemnoscTabeli(ws: ExcelJS.Worksheet, nrNaglowka: number): number {
  for (let nr = nrNaglowka + 1; nr <= ws.rowCount; nr++) {
    if (norm(tekstKomorki(ws.getRow(nr).getCell(2))) === "razem") return nr - nrNaglowka - 1;
  }
  return Math.max(0, ws.rowCount - nrNaglowka);
}

export async function zbudujExcelWniosku(
  dane: Wniosek,
  meta: { nrReferencyjny: string },
): Promise<Buffer> {
  const skoroszyt = new ExcelJS.Workbook();
  // ExcelJS niesie wlasna, starsza deklaracje Buffera niz @types/node w tym projekcie.
  // Bierzemy typ wprost z sygnatury `load`, zeby nie zgadywac, ktory wariant jest w scope.
  type BuforExcelJs = Parameters<typeof skoroszyt.xlsx.load>[0];
  await skoroszyt.xlsx.load((await readFile(SZABLON)) as unknown as BuforExcelJs);

  const arkusz = (fragment: string) =>
    skoroszyt.worksheets.find((ws) => norm(ws.name).includes(norm(fragment)));

  const pominiete: string[] = [];

  // --- Sekcje 1 i 3 ---
  const wsFirma = arkusz("dane firmy");
  if (wsFirma) {
    const i = zindeksuj(wsFirma);
    ustaw(wsFirma, i, "Nazwa firmy / imię i nazwisko", dane.nazwa_firmy);
    ustaw(wsFirma, i, "NIP", dane.nip);
    ustaw(wsFirma, i, "REGON", dane.regon);
    ustaw(wsFirma, i, "KRS", dane.krs);
    ustaw(wsFirma, i, "Forma prawna", dane.forma_prawna);
    ustaw(wsFirma, i, "Adres siedziby", dane.adres_siedziby);
    ustaw(wsFirma, i, "Numer PKD", dane.numer_pkd);
    ustaw(wsFirma, i, "E-mail kontaktowy", dane.email_kontaktowy);
    ustaw(wsFirma, i, "Telefon", dane.telefon);
    ustaw(wsFirma, i, "Osoba do kontaktu", dane.osoba_kontaktu);
    ustaw(wsFirma, i, "Stanowisko", dane.stanowisko);
    ustaw(wsFirma, i, "Rodzaj działalności", dane.rodzaj_dzialalnosci);
    ustaw(wsFirma, i, "Liczba pracowników", dane.liczba_pracownikow);
    ustaw(wsFirma, i, "Szacunkowy roczny obrót", dane.roczny_obrot);

    // Numer referencyjny w naglowku, zeby plik dalo sie powiazac z wnioskiem w panelu.
    const naglowek = wsFirma.getCell("B3");
    if (!naglowek.formula) {
      naglowek.value = `Wniosek ${meta.nrReferencyjny} — wygenerowany z systemu Aura Expert`;
    }
  }

  // --- Sekcje 2 i 4 dla kazdej lokalizacji ---
  for (const lok of dane.lokalizacje) {
    const ws = arkusz(`Lokalizacja ${lok.nr}`);
    if (!ws) {
      pominiete.push(`Lokalizacja ${lok.nr} — szablon obejmuje tylko 3 lokalizacje`);
      continue;
    }
    const i = zindeksuj(ws);

    ustaw(ws, i, "Nazwa lokalizacji", lok.nazwa);
    ustaw(ws, i, "Adres lokalizacji ubezpieczenia", lok.adres);
    ustaw(ws, i, "Typ lokalu", lok.typ_lokalu);
    ustaw(ws, i, "Piętro / kondygnacja", lok.pietro);
    ustaw(ws, i, "Powierzchnia (m²)", lok.powierzchnia);
    ustaw(ws, i, "Rok budowy", lok.rok_budowy);
    ustaw(ws, i, "Rok ostatniego remontu", lok.rok_remontu);
    ustaw(ws, i, "Materiał ścian", lok.material_scian);
    ustaw(ws, i, "Pokrycie dachu", lok.pokrycie_dachu);
    ustaw(ws, i, "Stan techniczny", lok.stan_techniczny);
    ustaw(ws, i, "Ogrzewanie", lok.ogrzewanie);
    ustaw(ws, i, "Budynek własny (nie najemca)", lok.budynek_wlasny);
    ustaw(ws, i, "Materiały palne w produkcji / procesie", lok.materialy_palne);

    ustaw(ws, i, "Gaśnice (liczba sztuk)", lok.gasnice_szt);
    ustaw(ws, i, "Data przeglądu gaśnic", lok.data_przegladu_gasnic);
    ustaw(ws, i, "Odległość od PSP (km)", lok.odleglosc_psp);
    ustaw(ws, i, "Hydranty wewnętrzne", lok.hydranty);
    ustaw(ws, i, "System alarmowania pożaru (SAP)", lok.sap);
    ustaw(ws, i, "Tryskacze / automatyczny system gaśniczy", lok.tryskacze);
    ustaw(ws, i, "Oznakowane drogi ewakuacyjne", lok.drogi_ewakuacyjne);
    ustaw(ws, i, "Zakaz palenia na obiekcie", lok.zakaz_palenia);

    ustaw(ws, i, "Alarm — typ", lok.alarm_typ || "brak");
    ustaw(ws, i, "Agencja ochrony (nazwa)", lok.agencja_ochrony);
    ustaw(ws, i, "Sejf / szafa stalowa — klasa", lok.sejf_klasa || "brak");
    ustaw(ws, i, "Ogrodzenie terenu", lok.ogrodzenie);
    ustaw(ws, i, "Agencja ochrony czynna 24h", lok.agencja_24h);
    ustaw(ws, i, "Monitoring wizyjny (CCTV)", lok.cctv);
    ustaw(ws, i, "Kraty w oknach", lok.kraty);
    ustaw(ws, i, "Rolety antywłamaniowe", lok.rolety);
    ustaw(ws, i, "Zamki atestowane", lok.zamki_atestowane);
    ustaw(ws, i, "Drzwi atestowane (antywłamaniowe)", lok.drzwi_atestowane);
    ustaw(ws, i, "Szyby antywłamaniowe", lok.szyby_antywlamaniowe);
    ustaw(ws, i, "Komputerowy system alarmowy", lok.system_alarmowy);

    ustaw(ws, i, "Budynek / nakłady adaptacyjne (najemcy)", lok.suma_budynek);
    ustaw(ws, i, "Wyposażenie stałe (meble, zabudowa)", lok.suma_wyposazenie);
    ustaw(ws, i, "Maszyny i urządzenia produkcyjne", lok.suma_maszyny);
    ustaw(ws, i, "Środki obrotowe (towary, kosmetyki, preparaty)", lok.suma_srodki_obrotowe);
    ustaw(ws, i, "Sprzęt elektroniczny (IT, kasy fiskalne)", lok.suma_elektronika_it);
    ustaw(ws, i, "Sprzęt medyczny / estetyczny", lok.suma_sprzet_medyczny);
    ustaw(ws, i, "Gotówka w lokalu (max jednorazowo)", lok.suma_gotowka_lokal);
    ustaw(ws, i, "Gotówka w transporcie (max jednorazowo)", lok.suma_gotowka_transport);
    ustaw(ws, i, "Szyby i inne przedmioty od stłuczenia", lok.suma_szyby);
    ustaw(ws, i, "Mienie pracowników", lok.suma_mienie_pracownikow);
  }

  // --- Wykaz sprzetu medycznego ---
  const wsMed = arkusz("Sprzęt medyczny");
  if (wsMed) {
    const { nrNaglowka, kolumny } = naglowkiTabeli(wsMed);
    const pojemnosc = pojemnoscTabeli(wsMed, nrNaglowka);
    dane.sprzet_medyczny.slice(0, pojemnosc).forEach((u, idx) => {
      const row = wsMed.getRow(nrNaglowka + 1 + idx);
      row.getCell(kol(kolumny, "Lokalizacja")).value = `Lokalizacja ${u.lokalizacja}`;
      row.getCell(kol(kolumny, "Nazwa urządzenia")).value = u.nazwa;
      row.getCell(kol(kolumny, "Producent")).value = u.producent;
      row.getCell(kol(kolumny, "Model")).value = u.model;
      row.getCell(kol(kolumny, "Nr seryjny")).value = u.nr_seryjny;
      row.getCell(kol(kolumny, "Rok zakupu")).value = u.rok_zakupu;
      row.getCell(kol(kolumny, "Wartość (PLN)")).value = u.wartosc || null;
      row.getCell(kol(kolumny, "Cert. CE")).value = u.cert_ce ? "TAK" : "NIE";
      row.getCell(kol(kolumny, "Uwagi")).value = u.uwagi;
    });
    if (dane.sprzet_medyczny.length > pojemnosc) {
      pominiete.push(
        `Sprzęt medyczny: ${dane.sprzet_medyczny.length - pojemnosc} poz. ponad ${pojemnosc} miejsc w szablonie`,
      );
    }
  }

  // --- Wykaz elektroniki ---
  const wsEei = arkusz("Elektronika");
  if (wsEei) {
    const { nrNaglowka, kolumny } = naglowkiTabeli(wsEei);
    const pojemnosc = pojemnoscTabeli(wsEei, nrNaglowka);
    dane.elektronika_eei.slice(0, pojemnosc).forEach((u, idx) => {
      const row = wsEei.getRow(nrNaglowka + 1 + idx);
      row.getCell(kol(kolumny, "Lokalizacja")).value = `Lokalizacja ${u.lokalizacja}`;
      row.getCell(kol(kolumny, "Nazwa urządzenia")).value = u.nazwa;
      row.getCell(kol(kolumny, "Producent")).value = u.producent;
      row.getCell(kol(kolumny, "Model")).value = u.model;
      row.getCell(kol(kolumny, "Rok zakupu")).value = u.rok_zakupu;
      row.getCell(kol(kolumny, "Wartość (PLN)")).value = u.wartosc || null;
      row.getCell(kol(kolumny, "Nr seryjny")).value = u.nr_seryjny;
      row.getCell(kol(kolumny, "Uwagi")).value = u.uwagi;
    });
    if (dane.elektronika_eei.length > pojemnosc) {
      pominiete.push(
        `Elektronika EEI: ${dane.elektronika_eei.length - pojemnosc} poz. ponad ${pojemnosc} miejsc w szablonie`,
      );
    }
  }

  // --- Sekcja 7 ---
  const wsSzkody = arkusz("Szkodowość");
  if (wsSzkody) {
    const i = zindeksuj(wsSzkody);
    ustaw(wsSzkody, i, "Brak szkód w ostatnich 5 latach", dane.brak_szkod);

    const { nrNaglowka, kolumny } = naglowkiTabeli(wsSzkody);
    const pojemnosc = pojemnoscTabeli(wsSzkody, nrNaglowka);
    dane.szkody.slice(0, pojemnosc).forEach((s, idx) => {
      const row = wsSzkody.getRow(nrNaglowka + 1 + idx);
      row.getCell(kol(kolumny, "Data szkody")).value = s.data;
      row.getCell(kol(kolumny, "Przyczyna")).value = s.przyczyna;
      row.getCell(kol(kolumny, "Kwota szkody (PLN)")).value = s.kwota_szkody || null;
      row.getCell(kol(kolumny, "Odszkodowanie (PLN)")).value = s.odszkodowanie || null;
      row.getCell(kol(kolumny, "Ubezpieczyciel")).value = s.ubezpieczyciel;
    });
    if (dane.szkody.length > pojemnosc) {
      pominiete.push(`Szkody: ${dane.szkody.length - pojemnosc} poz. ponad ${pojemnosc} miejsc w szablonie`);
    }
  }

  // --- Sekcje 5, 8, 9 ---
  const wsPodsum = arkusz("Podsumowanie");
  if (wsPodsum) {
    const i = zindeksuj(wsPodsum);
    const wZakresie = (pozycja: string) => dane.zakres.includes(pozycja as never);

    ustaw(wsPodsum, i, "Mienie od ognia i zdarzeń losowych", wZakresie("Mienie od ognia i zdarzeń losowych"));
    ustaw(wsPodsum, i, "↳ Szyby i inne przedmioty od stłuczenia", wZakresie("Szyby i inne przedmioty"));
    ustaw(wsPodsum, i, "↳ Dewastacja / wandalizm", wZakresie("Dewastacja / wandalizm"));
    ustaw(wsPodsum, i, "↳ Przepięcia elektryczne", wZakresie("Przepięcia elektryczne"));
    ustaw(wsPodsum, i, "Kradzież z włamaniem i rabunek", wZakresie("Kradzież z włamaniem i rabunek"));
    ustaw(wsPodsum, i, "Sprzęt elektroniczny (EEI)", wZakresie("Sprzęt elektroniczny (EEI)"));
    ustaw(wsPodsum, i, "Sprzęt medyczny / aparatura", wZakresie("Sprzęt medyczny / aparatura"));

    ustaw(wsPodsum, i, "Posiada aktualną polisę na mienie", dane.posiada_polise);
    ustaw(wsPodsum, i, "Towarzystwo ubezpieczeń", dane.towarzystwo_obecne);
    ustaw(wsPodsum, i, "Numer polisy", dane.nr_polisy_obecny);
    ustaw(wsPodsum, i, "Ważność polisy do", dane.waznosc_do);
    ustaw(wsPodsum, i, "Roczna składka (PLN)", dane.roczna_skladka_obecna);

    const uwagi = pominiete.length
      ? `${dane.uwagi}\n\nNie zmieściło się w szablonie: ${pominiete.join("; ")}`.trim()
      : dane.uwagi;
    ustaw(wsPodsum, i, "Uwagi, opis działalności, pytania do agenta", uwagi);
    ustaw(wsPodsum, i, "Miejscowość i data", dane.miejscowosc_podpisu);
  }

  const bufor = await skoroszyt.xlsx.writeBuffer();
  return Buffer.from(bufor);
}

/** Nazwa pliku do pobrania - bez znakow, ktore psuja naglowek Content-Disposition. */
export function nazwaPliku(nrReferencyjny: string, nazwaFirmy: string): string {
  const firma = nazwaFirmy
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/gi, "l")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${nrReferencyjny}${firma ? `_${firma}` : ""}.xlsx`;
}
