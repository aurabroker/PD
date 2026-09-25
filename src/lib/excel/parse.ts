import "server-only";
import ExcelJS from "exceljs";
import { pustaLokalizacja, wniosekRoboczySchema, wniosekSchema } from "../schema";
import type { Lokalizacja, WniosekRoboczy } from "../schema";
import {
  ALARM_TYP,
  FORMA_PRAWNA,
  LICZBA_PRACOWNIKOW,
  MATERIAL_SCIAN,
  OGRZEWANIE,
  POKRYCIE_DACHU,
  ROCZNY_OBROT,
  SEJF_KLASA,
  STAN_TECHNICZNY,
  TYP_LOKALU,
  ZAKRES,
  ZAKRES_ALIASY,
} from "../slowniki";
import { rozdzielMiejscowoscIDate } from "../porzadkowanie";
import { zbadajZgodnosc, type Zgodnosc } from "./zgodnosc";

/**
 * Import wniosku z szablonu .xlsx.
 *
 * Dane sa odnajdywane po etykiecie w kolumnie opisowej, a nie po adresie komorki.
 * Dzieki temu dodanie lub usuniecie wiersza w szablonie nie psuje importu,
 * a pliki wypelnione na starszej wersji szablonu nadal sie wczytuja.
 */

export type OstrzezenieImportu = { arkusz: string; opis: string };

export type WynikImportu = {
  dane: WniosekRoboczy;
  ostrzezenia: OstrzezenieImportu[];
  /** Czy plik to nasz szablon — dla agenta, nie blokuje importu. */
  zgodnosc: Zgodnosc | null;
};

/** Normalizacja etykiety: bez ogonkow, bez gwiazdki pola wymaganego, bez podwojnych spacji. */
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

/** Tekst komorki - ExcelJS zwraca formuly i teksty bogate jako obiekty. */
function komorkaTekst(kom: ExcelJS.Cell | undefined): string {
  if (!kom) return "";
  const v = kom.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return String(v.result);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if (v instanceof Date) return v.toLocaleDateString("pl-PL");
    return "";
  }
  return String(v);
}

function komorkaLiczba(kom: ExcelJS.Cell | undefined): number {
  const surowe = komorkaTekst(kom)
    .replace(/\s| /g, "")
    .replace(/zl|pln/gi, "")
    .replace(",", ".");
  const n = Number(surowe);
  return Number.isFinite(n) ? n : 0;
}

/** TAK/NIE z arkusza. Puste pole i wszystko poza "tak" znaczy nie. */
function komorkaTak(kom: ExcelJS.Cell | undefined): boolean {
  const v = norm(komorkaTekst(kom));
  return v === "tak" || v === "true" || v === "x" || v === "1";
}

/**
 * Indeks arkusza: etykieta z kolumny B -> wiersz.
 * Przy powtorzonych etykietach wygrywa pierwsze wystapienie.
 */
function zindeksuj(ws: ExcelJS.Worksheet): Map<string, number> {
  const indeks = new Map<string, number>();
  ws.eachRow((row, nrWiersza) => {
    const etykieta = norm(komorkaTekst(row.getCell(2)));
    if (etykieta && !indeks.has(etykieta)) indeks.set(etykieta, nrWiersza);
  });
  return indeks;
}

/** Wartosc przypisana do etykiety - w szablonie stoi w kolumnie C. */
function wartosc(ws: ExcelJS.Worksheet, indeks: Map<string, number>, etykieta: string) {
  const nrWiersza = indeks.get(norm(etykieta));
  return nrWiersza ? ws.getRow(nrWiersza).getCell(3) : undefined;
}

/** Dopasowanie do slownika - chroni przed literowka lub wartoscia spoza listy. */
function zeSlownika<T extends readonly string[]>(
  surowe: string,
  lista: T,
  kontekst: { arkusz: string; pole: string },
  ostrzezenia: OstrzezenieImportu[],
): T[number] | "" {
  const v = surowe.trim();
  if (!v) return "";
  const trafienie = lista.find((opcja) => norm(opcja) === norm(v)) as T[number] | undefined;
  if (trafienie) return trafienie;

  ostrzezenia.push({
    arkusz: kontekst.arkusz,
    opis: `Pole „${kontekst.pole}": wartość „${v}" nie występuje na liście — pominięto, uzupełnij ją w formularzu.`,
  });
  return "";
}

/** Wiersze tabeli: od wiersza naglowka w dol, az do pustego wiersza lub "RAZEM". */
function wierszeTabeli(
  ws: ExcelJS.Worksheet,
  naglowek: string,
): { naglowki: Map<string, number>; wiersze: ExcelJS.Row[] } {
  let nrNaglowka = 0;
  ws.eachRow((row, nr) => {
    if (!nrNaglowka && norm(komorkaTekst(row.getCell(2))) === norm(naglowek)) nrNaglowka = nr;
  });

  if (!nrNaglowka) return { naglowki: new Map(), wiersze: [] };

  const naglowki = new Map<string, number>();
  const wierszNaglowka = ws.getRow(nrNaglowka);
  wierszNaglowka.eachCell((kom, nrKolumny) => {
    const nazwa = norm(komorkaTekst(kom));
    if (nazwa) naglowki.set(nazwa, nrKolumny);
  });

  const wiersze: ExcelJS.Row[] = [];
  for (let nr = nrNaglowka + 1; nr <= ws.rowCount; nr++) {
    const row = ws.getRow(nr);
    if (norm(komorkaTekst(row.getCell(2))) === "razem") break;
    wiersze.push(row);
  }

  return { naglowki, wiersze };
}

/** Czy wiersz tabeli niesie jakakolwiek tresc poza numerem porzadkowym. */
function wierszNiepusty(row: ExcelJS.Row, naglowki: Map<string, number>): boolean {
  for (const [nazwa, nrKolumny] of naglowki) {
    if (nazwa === "lp.") continue;
    if (komorkaTekst(row.getCell(nrKolumny)).trim()) return true;
  }
  return false;
}

const kol = (naglowki: Map<string, number>, ...nazwy: string[]): number => {
  for (const n of nazwy) {
    const nr = naglowki.get(norm(n));
    if (nr) return nr;
  }
  return 0;
};

/** Numer lokalizacji z komorki "Lokalizacja 2" -> 2. */
function numerLokalizacji(tekst: string): number {
  const m = tekst.match(/(\d+)/);
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= 3 ? n : 1;
}

function czytajLokalizacje(
  ws: ExcelJS.Worksheet,
  nr: number,
  ostrzezenia: OstrzezenieImportu[],
): { lokalizacja: Lokalizacja; wypelniona: boolean } {
  const indeks = zindeksuj(ws);
  const arkusz = ws.name;
  const t = (etykieta: string) => komorkaTekst(wartosc(ws, indeks, etykieta)).trim();
  const n = (etykieta: string) => komorkaLiczba(wartosc(ws, indeks, etykieta));
  const b = (etykieta: string) => komorkaTak(wartosc(ws, indeks, etykieta));
  const slownik = <T extends readonly string[]>(etykieta: string, lista: T) =>
    zeSlownika(t(etykieta), lista, { arkusz, pole: etykieta }, ostrzezenia);

  const powierzchniaTekst = t("Powierzchnia (m²)");

  const lokalizacja: Lokalizacja = {
    ...pustaLokalizacja(nr),
    nazwa: t("Nazwa lokalizacji"),
    adres: t("Adres lokalizacji ubezpieczenia"),
    typ_lokalu: slownik("Typ lokalu", TYP_LOKALU),
    pietro: t("Piętro / kondygnacja"),
    powierzchnia: powierzchniaTekst ? n("Powierzchnia (m²)") : null,
    rok_budowy: t("Rok budowy"),
    rok_remontu: t("Rok ostatniego remontu"),
    material_scian: slownik("Materiał ścian", MATERIAL_SCIAN),
    pokrycie_dachu: slownik("Pokrycie dachu", POKRYCIE_DACHU),
    stan_techniczny: slownik("Stan techniczny", STAN_TECHNICZNY),
    ogrzewanie: slownik("Ogrzewanie", OGRZEWANIE),
    budynek_wlasny: b("Budynek własny (nie najemca)"),
    materialy_palne: b("Materiały palne w produkcji / procesie"),

    gasnice_szt: t("Gaśnice (liczba sztuk)"),
    data_przegladu_gasnic: t("Data przeglądu gaśnic"),
    odleglosc_psp: t("Odległość od PSP (km)"),
    hydranty: b("Hydranty wewnętrzne"),
    sap: b("System alarmowania pożaru (SAP)"),
    tryskacze: b("Tryskacze / automatyczny system gaśniczy"),
    drogi_ewakuacyjne: b("Oznakowane drogi ewakuacyjne"),
    zakaz_palenia: b("Zakaz palenia na obiekcie"),

    alarm_typ: slownik("Alarm — typ", ALARM_TYP),
    agencja_ochrony: t("Agencja ochrony (nazwa)"),
    sejf_klasa: slownik("Sejf / szafa stalowa — klasa", SEJF_KLASA),
    ogrodzenie: b("Ogrodzenie terenu"),
    agencja_24h: b("Agencja ochrony czynna 24h"),
    cctv: b("Monitoring wizyjny (CCTV)"),
    kraty: b("Kraty w oknach"),
    rolety: b("Rolety antywłamaniowe"),
    zamki_atestowane: b("Zamki atestowane"),
    drzwi_atestowane: b("Drzwi atestowane (antywłamaniowe)"),
    szyby_antywlamaniowe: b("Szyby antywłamaniowe"),
    system_alarmowy: b("Komputerowy system alarmowy"),

    suma_budynek: n("Budynek / nakłady adaptacyjne (najemcy)"),
    suma_wyposazenie: n("Wyposażenie stałe (meble, zabudowa)"),
    suma_maszyny: n("Maszyny i urządzenia produkcyjne"),
    suma_srodki_obrotowe: n("Środki obrotowe (towary, kosmetyki, preparaty)"),
    suma_elektronika_it: n("Sprzęt elektroniczny (IT, kasy fiskalne)"),
    suma_sprzet_medyczny: n("Sprzęt medyczny / estetyczny"),
    suma_gotowka_lokal: n("Gotówka w lokalu (max jednorazowo)"),
    suma_gotowka_transport: n("Gotówka w transporcie (max jednorazowo)"),
    suma_szyby: n("Szyby i inne przedmioty od stłuczenia"),
    suma_mienie_pracownikow: n("Mienie pracowników"),
  };

  // Lokalizacje 2 i 3 sa w szablonie opcjonalne - pusta zakladka nie trafia do wniosku.
  const wypelniona = Boolean(
    lokalizacja.adres || lokalizacja.nazwa || lokalizacja.powierzchnia || lokalizacja.typ_lokalu,
  );

  return { lokalizacja, wypelniona };
}

export async function wczytajWniosekZExcela(plik: ArrayBuffer): Promise<WynikImportu> {
  const skoroszyt = new ExcelJS.Workbook();
  await skoroszyt.xlsx.load(plik);

  const ostrzezenia: OstrzezenieImportu[] = [];
  const arkusz = (fragment: string) =>
    skoroszyt.worksheets.find((ws) => norm(ws.name).includes(norm(fragment)));

  // --- Sekcja 1 i 3: dane firmy ---
  const wsFirma = arkusz("dane firmy");
  if (!wsFirma) {
    throw new Error(
      'Nie znaleziono zakładki „1. Dane firmy". Czy to na pewno wniosek na formularzu Aura Expert?',
    );
  }

  const indeksFirma = zindeksuj(wsFirma);
  const tf = (etykieta: string) => komorkaTekst(wartosc(wsFirma, indeksFirma, etykieta)).trim();

  const daneFirmy = {
    nazwa_firmy: tf("Nazwa firmy / imię i nazwisko"),
    nip: tf("NIP"),
    regon: tf("REGON"),
    krs: tf("KRS"),
    adres_siedziby: tf("Adres siedziby"),
    forma_prawna: zeSlownika(
      tf("Forma prawna"),
      FORMA_PRAWNA,
      { arkusz: wsFirma.name, pole: "Forma prawna" },
      ostrzezenia,
    ),
    numer_pkd: tf("Numer PKD"),
    email_kontaktowy: tf("E-mail kontaktowy"),
    telefon: tf("Telefon"),
    osoba_kontaktu: tf("Osoba do kontaktu"),
    stanowisko: tf("Stanowisko"),
    rodzaj_dzialalnosci: tf("Rodzaj działalności"),
    liczba_pracownikow: zeSlownika(
      tf("Liczba pracowników"),
      LICZBA_PRACOWNIKOW,
      { arkusz: wsFirma.name, pole: "Liczba pracowników" },
      ostrzezenia,
    ),
    roczny_obrot: zeSlownika(
      tf("Szacunkowy roczny obrót"),
      ROCZNY_OBROT,
      { arkusz: wsFirma.name, pole: "Szacunkowy roczny obrót" },
      ostrzezenia,
    ),
  };

  // --- Sekcje 2 i 4: lokalizacje ---
  const lokalizacje: Lokalizacja[] = [];
  for (let nr = 1; nr <= 3; nr++) {
    const ws = arkusz(`Lokalizacja ${nr}`);
    if (!ws) continue;
    const { lokalizacja, wypelniona } = czytajLokalizacje(ws, nr, ostrzezenia);
    if (wypelniona || nr === 1) lokalizacje.push(lokalizacja);
  }
  if (lokalizacje.length === 0) lokalizacje.push(pustaLokalizacja(1));

  // Przenumerowanie: gdy klient wypelnil tylko lokalizacje 1 i 3, maja byc 1 i 2.
  lokalizacje.forEach((lok, i) => {
    lok.nr = i + 1;
  });

  // --- Wykaz sprzetu medycznego ---
  const sprzetMedyczny: WniosekRoboczy["sprzet_medyczny"] = [];
  const wsMed = arkusz("Sprzęt medyczny");
  if (wsMed) {
    const { naglowki, wiersze } = wierszeTabeli(wsMed, "Lp.");
    for (const row of wiersze) {
      if (!wierszNiepusty(row, naglowki)) continue;
      sprzetMedyczny.push({
        lokalizacja: numerLokalizacji(komorkaTekst(row.getCell(kol(naglowki, "Lokalizacja")))),
        nazwa: komorkaTekst(row.getCell(kol(naglowki, "Nazwa urządzenia"))).trim(),
        producent: komorkaTekst(row.getCell(kol(naglowki, "Producent"))).trim(),
        model: komorkaTekst(row.getCell(kol(naglowki, "Model"))).trim(),
        nr_seryjny: komorkaTekst(row.getCell(kol(naglowki, "Nr seryjny"))).trim(),
        rok_zakupu: komorkaTekst(row.getCell(kol(naglowki, "Rok zakupu"))).trim(),
        wartosc: komorkaLiczba(row.getCell(kol(naglowki, "Wartość (PLN)"))),
        cert_ce: komorkaTak(row.getCell(kol(naglowki, "Cert. CE"))),
        uwagi: komorkaTekst(row.getCell(kol(naglowki, "Uwagi"))).trim(),
      });
    }
  }

  // --- Wykaz elektroniki EEI ---
  const elektronika: WniosekRoboczy["elektronika_eei"] = [];
  const wsEei = arkusz("Elektronika");
  if (wsEei) {
    const { naglowki, wiersze } = wierszeTabeli(wsEei, "Lp.");
    for (const row of wiersze) {
      if (!wierszNiepusty(row, naglowki)) continue;
      elektronika.push({
        lokalizacja: numerLokalizacji(komorkaTekst(row.getCell(kol(naglowki, "Lokalizacja")))),
        nazwa: komorkaTekst(row.getCell(kol(naglowki, "Nazwa urządzenia"))).trim(),
        producent: komorkaTekst(row.getCell(kol(naglowki, "Producent"))).trim(),
        model: komorkaTekst(row.getCell(kol(naglowki, "Model"))).trim(),
        rok_zakupu: komorkaTekst(row.getCell(kol(naglowki, "Rok zakupu"))).trim(),
        wartosc: komorkaLiczba(row.getCell(kol(naglowki, "Wartość (PLN)"))),
        nr_seryjny: komorkaTekst(row.getCell(kol(naglowki, "Nr seryjny"))).trim(),
        uwagi: komorkaTekst(row.getCell(kol(naglowki, "Uwagi"))).trim(),
      });
    }
  }

  // --- Sekcja 7: szkodowosc ---
  let brakSzkod = true;
  const szkody: WniosekRoboczy["szkody"] = [];
  const wsSzkody = arkusz("Szkodowość");
  if (wsSzkody) {
    const indeks = zindeksuj(wsSzkody);
    brakSzkod = komorkaTak(wartosc(wsSzkody, indeks, "Brak szkód w ostatnich 5 latach"));

    const { naglowki, wiersze } = wierszeTabeli(wsSzkody, "Lp.");
    for (const row of wiersze) {
      if (!wierszNiepusty(row, naglowki)) continue;
      szkody.push({
        data: komorkaTekst(row.getCell(kol(naglowki, "Data szkody"))).trim(),
        przyczyna: komorkaTekst(row.getCell(kol(naglowki, "Przyczyna"))).trim(),
        kwota_szkody: komorkaLiczba(row.getCell(kol(naglowki, "Kwota szkody (PLN)"))),
        odszkodowanie: komorkaLiczba(row.getCell(kol(naglowki, "Odszkodowanie (PLN)"))),
        ubezpieczyciel: komorkaTekst(row.getCell(kol(naglowki, "Ubezpieczyciel"))).trim(),
      });
    }
  }

  // Arkusz sam sobie przeczy: zadeklarowano brak szkod, a tabela wypelniona.
  if (brakSzkod && szkody.length > 0) {
    brakSzkod = false;
    ostrzezenia.push({
      arkusz: wsSzkody?.name ?? "7. Szkodowość",
      opis: 'Zaznaczono „Brak szkód", ale tabela szkód jest wypełniona — przyjęto, że szkody wystąpiły.',
    });
  }

  // --- Sekcje 5, 8, 9: podsumowanie ---
  let zakres: string[] = [];
  const podsumowanie = {
    posiada_polise: false,
    towarzystwo_obecne: "",
    nr_polisy_obecny: "",
    waznosc_do: "",
    roczna_skladka_obecna: null as number | null,
    uwagi: "",
    miejscowosc_podpisu: "",
    data_podpisu: "",
    zgoda_prawdziwosc: false,
    zgoda_rodo: false,
  };

  const wsPodsum = arkusz("Podsumowanie");
  if (wsPodsum) {
    const indeks = zindeksuj(wsPodsum);
    const tp = (etykieta: string) => komorkaTekst(wartosc(wsPodsum, indeks, etykieta)).trim();
    const bp = (etykieta: string) => komorkaTak(wartosc(wsPodsum, indeks, etykieta));

    /**
     * Zakres jest czytany po etykiecie wiersza, a nie po pozycji, bo szablony
     * roznia sie brzmieniem (np. "Szyby i inne przedmioty od stluczenia").
     * Etykiety podpunktow maja wciecie ze strzalka - norm() je zdejmuje.
     */
    const zaznaczone = new Set<string>();
    const sprawdz = (etykieta: string, kanoniczna: string) => {
      for (const wariant of [etykieta, `↳ ${etykieta}`]) {
        const nrWiersza = indeks.get(norm(wariant));
        if (nrWiersza && komorkaTak(wsPodsum.getRow(nrWiersza).getCell(3))) {
          zaznaczone.add(kanoniczna);
          return;
        }
      }
    };

    for (const pozycja of ZAKRES) sprawdz(pozycja, pozycja);
    for (const [alias, kanoniczna] of Object.entries(ZAKRES_ALIASY)) sprawdz(alias, kanoniczna);

    zakres = ZAKRES.filter((pozycja) => zaznaczone.has(pozycja)) as unknown as string[];

    podsumowanie.posiada_polise = bp("Posiada aktualną polisę na mienie");
    podsumowanie.towarzystwo_obecne = tp("Towarzystwo ubezpieczeń");
    podsumowanie.nr_polisy_obecny = tp("Numer polisy");
    podsumowanie.waznosc_do = tp("Ważność polisy do");
    const skladka = tp("Roczna składka (PLN)");
    podsumowanie.roczna_skladka_obecna = skladka
      ? komorkaLiczba(wartosc(wsPodsum, indeks, "Roczna składka (PLN)"))
      : null;
    // Pole uwag to scalona ramka POD etykieta (w szablonie B37:F41), a nie komorka
    // obok niej jak w pozostalych polach. Kolumna C wiersza etykiety zostaje jako
    // zapas — tam zapisywaly uwagi eksporty sprzed poprawki.
    const nrUwag = indeks.get(norm("Uwagi, opis działalności, pytania do agenta"));
    podsumowanie.uwagi = nrUwag
      ? komorkaTekst(wsPodsum.getRow(nrUwag + 1).getCell(2)).trim() ||
        tp("Uwagi, opis działalności, pytania do agenta")
      : "";
    // W szablonie to jedna komórka „Miejscowość i data” — rozdzielamy na dwa pola.
    const { miejscowosc, data } = rozdzielMiejscowoscIDate(tp("Miejscowość i data"));
    podsumowanie.miejscowosc_podpisu = miejscowosc;
    podsumowanie.data_podpisu = data;
    podsumowanie.zgoda_prawdziwosc = Boolean(
      indeks.get(norm("Oświadczam, że wszystkie informacje podane w niniejszym wniosku są zgodne z prawdą i odzwierciedlają rzeczywisty stan faktyczny.")),
    );
  }

  const surowe = {
    ...daneFirmy,
    zabiegi: [] as string[],
    lokalizacje,
    zakres,
    sprzet_medyczny: sprzetMedyczny,
    elektronika_eei: elektronika,
    brak_szkod: brakSzkod,
    szkody,
    ...podsumowanie,
    // Zgody musza zostac potwierdzone w formularzu - plik ich nie zastepuje.
    zgoda_prawdziwosc: false,
    zgoda_rodo: false,
  };

  // Pelny schemat tylko opisuje braki (np. pusty e-mail) jako ostrzezenia.
  // Dane zawsze przechodza przez schemat roboczy - plik moze byc niekompletny,
  // a klient dopelnia braki w formularzu przed zlozeniem.
  const kontrola = wniosekSchema.safeParse(surowe);
  if (!kontrola.success) {
    for (const problem of kontrola.error.issues) {
      ostrzezenia.push({
        arkusz: String(problem.path[0] ?? "wniosek"),
        opis: `${problem.path.join(".")}: ${problem.message}`,
      });
    }
  }

  // Blad porownania z szablonem nie moze zablokowac importu — wtedy brak wyniku.
  const zgodnosc = await zbadajZgodnosc(skoroszyt).catch((e) => {
    console.error("[import] porownanie z szablonem:", e);
    return null;
  });

  return { dane: wniosekRoboczySchema.parse(surowe), ostrzezenia, zgodnosc };
}
