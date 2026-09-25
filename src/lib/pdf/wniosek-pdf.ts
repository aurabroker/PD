import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { zl } from "../format";
import { sumaLokalizacji, sumaWniosku, type WniosekRoboczy } from "../schema";
import { POZYCJE_SUM } from "../slowniki";
import { DYSTRYBUTOR, TRESC_ZGODY } from "../dystrybutor";
import { jestBrak, tytulLokalizacji } from "../porzadkowanie";
import { FONT_BOLD, FONT_REGULAR, LOGO_PDF } from "./zasoby.generated";

/**
 * Kopia złożonego wniosku w PDF — załącznik maila do klienta i do agentów.
 *
 * pdf-lib działa w Workerze (czysty JS, bez fs i canvasa). Standardowe fonty
 * PDF nie mają polskich znaków, więc osadzamy przyciętą Liberation Sans
 * (assets/fonty/, SIL OFL). Znak spoza zestawu fontu (np. emoji wpisane przez
 * klienta) zamieniamy na „?” — inaczej w PDF zostałaby pusta ramka.
 *
 * Układ odpowiada karcie wniosku w panelu agenta: te same sekcje i etykiety.
 */

export type DanePdf = {
  dane: WniosekRoboczy;
  nrReferencyjny: string;
  zlozono: Date | null;
};

// A4 w punktach
const SZER = 595.28;
const WYS = 841.89;
const MARGINES = 48;
const DOL = 64; // miejsce na stopkę
const TRESC = SZER - 2 * MARGINES;

const KOLOR = {
  // Kolory z logo Aura Expert (jak w aplikacji i mailach).
  marka: rgb(0x00 / 255, 0x76 / 255, 0x9f / 255),
  akcent: rgb(0x00 / 255, 0xa4 / 255, 0xdc / 255),
  markaJasna: rgb(0xee / 255, 0xf9 / 255, 0xfd / 255),
  markaRamka: rgb(0xb0 / 255, 0xe3 / 255, 0xf5 / 255),
  tekst: rgb(0x1c / 255, 0x19 / 255, 0x17 / 255),
  szary: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  szaryJasny: rgb(0xa8 / 255, 0xa2 / 255, 0x9e / 255),
  linia: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
  tlo: rgb(0xf5 / 255, 0xf5 / 255, 0xf4 / 255),
  bialy: rgb(1, 1, 1),
};

/** Zakresy znaków obecnych w przyciętym foncie (patrz assets/fonty). */
const ZAKRESY_FONTU: [number, number][] = [
  [0x20, 0x7e],
  [0xa0, 0x17f],
  [0x2010, 0x2027],
  [0x2030, 0x2030],
  [0x2032, 0x2033],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2190, 0x2193],
  [0x2212, 0x2212],
];

const wFoncie = (kod: number) => ZAKRESY_FONTU.some(([od, doo]) => kod >= od && kod <= doo);

/** Tekst gotowy do narysowania: bez znaków sterujących i spoza fontu. */
export function oczysc(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u2028\u2029]/g, "\n")
    .split("\n")
    .map((linia) =>
      Array.from(linia)
        .map((z) => (wFoncie(z.codePointAt(0)!) ? z : "?"))
        .join(""),
    )
    .join("\n");
}

export function base64NaBajty(b64: string): Uint8Array {
  const bin = atob(b64);
  const wynik = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) wynik[i] = bin.charCodeAt(i);
  return wynik;
}

const dataPl = (d: Date) =>
  d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

type Styl = { font?: PDFFont; rozmiar?: number; kolor?: RGB };

/** Prosty silnik składu: bieżąca strona, pozycja y, łamanie wierszy i stron. */
class Sklad {
  strona!: PDFPage;
  y = 0;
  private naglowekTabeli: (() => void) | null = null;

  constructor(
    readonly doc: PDFDocument,
    readonly zwykly: PDFFont,
    readonly gruby: PDFFont,
    readonly nr: string,
  ) {}

  nowaStrona() {
    this.strona = this.doc.addPage([SZER, WYS]);
    this.y = WYS - MARGINES;
    if (this.doc.getPageCount() > 1) {
      this.strona.drawText(oczysc(`Wniosek ${this.nr}`), {
        x: MARGINES,
        y: WYS - 30,
        size: 8,
        font: this.zwykly,
        color: KOLOR.szaryJasny,
      });
      this.y = WYS - MARGINES - 4;
      this.naglowekTabeli?.();
    }
  }

  /** Zapewnia `wysokosc` punktów miejsca; w razie potrzeby nowa strona. */
  miejsce(wysokosc: number) {
    if (this.y - wysokosc < DOL) this.nowaStrona();
  }

  zlam(tekst: string, font: PDFFont, rozmiar: number, szerokosc: number): string[] {
    const wynik: string[] = [];
    for (const akapit of oczysc(tekst).split("\n")) {
      const slowa = akapit.split(/ +/);
      let linia = "";
      for (let slowo of slowa) {
        // Słowo dłuższe niż kolumna (np. długi e-mail) — tniemy po znakach.
        while (font.widthOfTextAtSize(slowo, rozmiar) > szerokosc) {
          let n = slowo.length - 1;
          while (n > 1 && font.widthOfTextAtSize(slowo.slice(0, n), rozmiar) > szerokosc) n--;
          if (linia) {
            wynik.push(linia);
            linia = "";
          }
          wynik.push(slowo.slice(0, n));
          slowo = slowo.slice(n);
        }
        const proba = linia ? `${linia} ${slowo}` : slowo;
        if (font.widthOfTextAtSize(proba, rozmiar) <= szerokosc) {
          linia = proba;
        } else {
          wynik.push(linia);
          linia = slowo;
        }
      }
      wynik.push(linia);
    }
    return wynik;
  }

  tekst(tekst: string, x: number, szerokosc: number, s: Styl = {}): number {
    const font = s.font ?? this.zwykly;
    const rozmiar = s.rozmiar ?? 9.5;
    const interlinia = rozmiar * 1.35;
    const linie = this.zlam(tekst, font, rozmiar, szerokosc);
    for (const linia of linie) {
      this.miejsce(interlinia);
      this.strona.drawText(linia, { x, y: this.y - rozmiar, size: rozmiar, font, color: s.kolor ?? KOLOR.tekst });
      this.y -= interlinia;
    }
    return linie.length;
  }

  odstep(p: number) {
    this.y -= p;
  }

  sekcja(tytul: string) {
    this.miejsce(70); // tytuł nie zostaje sam na dole strony
    this.odstep(10);
    this.strona.drawText(oczysc(tytul.toUpperCase()), {
      x: MARGINES,
      y: this.y - 10,
      size: 10,
      font: this.gruby,
      color: KOLOR.marka,
    });
    this.y -= 15;
    this.strona.drawLine({
      start: { x: MARGINES, y: this.y },
      end: { x: SZER - MARGINES, y: this.y },
      thickness: 0.8,
      color: KOLOR.markaRamka,
    });
    this.y -= 8;
  }

  /** Wiersze „etykieta — wartość”; puste wartości pomijamy. */
  pola(pozycje: [string, unknown][]) {
    const SZER_ETYKIETY = 150;
    for (const [etykieta, wartosc] of pozycje) {
      const v = wartosc == null ? "" : String(wartosc).trim();
      if (!v) continue;
      const linie = this.zlam(v, this.zwykly, 9.5, TRESC - SZER_ETYKIETY);
      this.miejsce(Math.min(linie.length, 3) * 12.8 + 3);
      const yStart = this.y;
      const stronaStart = this.strona;
      this.strona.drawText(oczysc(etykieta), {
        x: MARGINES,
        y: this.y - 9,
        size: 8.5,
        font: this.zwykly,
        color: KOLOR.szary,
      });
      this.tekst(v, MARGINES + SZER_ETYKIETY, TRESC - SZER_ETYKIETY);
      if (this.strona === stronaStart && this.y > yStart - 12.8) this.y = yStart - 12.8;
      this.y -= 3;
    }
  }

  /**
   * Tabela z zawijaniem tekstu w komórkach. Nagłówek powtarza się na każdej
   * nowej stronie; wiersz nie jest dzielony między strony.
   */
  tabela(
    kolumny: { naglowek: string; szer: number; prawo?: boolean }[],
    wiersze: string[][],
    stopka?: string[],
  ) {
    const ROZMIAR = 8.5;
    const INTER = ROZMIAR * 1.3;
    const PAD = 4;
    const suma = kolumny.reduce((a, k) => a + k.szer, 0);
    const szer = kolumny.map((k) => (k.szer / suma) * TRESC);
    const xKolumny = szer.map((_, i) => MARGINES + szer.slice(0, i).reduce((a, b) => a + b, 0));

    const rysujWiersz = (komorki: string[], font: PDFFont, tlo?: RGB, kolor: RGB = KOLOR.tekst) => {
      const linie = komorki.map((k, i) => this.zlam(k, font, ROZMIAR, szer[i] - 2 * PAD));
      const wysokosc = Math.max(...linie.map((l) => l.length)) * INTER + 2 * PAD;
      this.miejsce(wysokosc);
      if (tlo) {
        this.strona.drawRectangle({ x: MARGINES, y: this.y - wysokosc, width: TRESC, height: wysokosc, color: tlo });
      }
      linie.forEach((l, i) => {
        l.forEach((linia, j) => {
          const w = font.widthOfTextAtSize(linia, ROZMIAR);
          const x = kolumny[i].prawo ? xKolumny[i] + szer[i] - PAD - w : xKolumny[i] + PAD;
          this.strona.drawText(linia, { x, y: this.y - PAD - ROZMIAR - j * INTER + 1.5, size: ROZMIAR, font, color: kolor });
        });
      });
      this.y -= wysokosc;
      this.strona.drawLine({
        start: { x: MARGINES, y: this.y },
        end: { x: SZER - MARGINES, y: this.y },
        thickness: 0.5,
        color: KOLOR.linia,
      });
    };

    const naglowek = () => rysujWiersz(kolumny.map((k) => k.naglowek), this.gruby, KOLOR.tlo, KOLOR.szary);
    this.miejsce(40);
    naglowek();
    this.naglowekTabeli = naglowek;
    for (const w of wiersze) rysujWiersz(w, this.zwykly);
    if (stopka) rysujWiersz(stopka, this.gruby, KOLOR.markaJasna);
    this.naglowekTabeli = null;
    this.y -= 4;
  }

  /** Ramka z tekstem (np. oświadczenie). Zwraca wysokość. */
  ramka(tekst: string, opcje: { tlo: RGB; obramowanie: RGB; rozmiar?: number; kolor?: RGB; font?: PDFFont }) {
    const rozmiar = opcje.rozmiar ?? 9;
    const PAD = 10;
    const font = opcje.font ?? this.zwykly;
    const linie = this.zlam(tekst, font, rozmiar, TRESC - 2 * PAD);
    const inter = rozmiar * 1.4;
    const wysokosc = linie.length * inter + 2 * PAD - (inter - rozmiar);
    this.miejsce(wysokosc + 4);
    this.strona.drawRectangle({
      x: MARGINES,
      y: this.y - wysokosc,
      width: TRESC,
      height: wysokosc,
      color: opcje.tlo,
      borderColor: opcje.obramowanie,
      borderWidth: 0.8,
    });
    linie.forEach((linia, i) => {
      this.strona.drawText(linia, {
        x: MARGINES + PAD,
        y: this.y - PAD - rozmiar - i * inter + 1.5,
        size: rozmiar,
        font,
        color: opcje.kolor ?? KOLOR.tekst,
      });
    });
    this.y -= wysokosc + 6;
  }
}

const tak = (b: boolean) => (b ? "TAK" : "NIE");

function listaZabezpieczen(pozycje: (string | false | undefined | null | "")[]): string {
  const widoczne = pozycje.filter(Boolean) as string[];
  return widoczne.length ? widoczne.join(", ") : "brak";
}

export async function generujPdfWniosku({ dane, nrReferencyjny, zlozono }: DanePdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const zwykly = await doc.embedFont(base64NaBajty(FONT_REGULAR), { subset: true });
  const gruby = await doc.embedFont(base64NaBajty(FONT_BOLD), { subset: true });

  doc.setTitle(oczysc(`Wniosek ${nrReferencyjny} — ubezpieczenie majątkowe`), { showInWindowTitleBar: true });
  doc.setAuthor(DYSTRYBUTOR.nazwa);
  doc.setSubject(oczysc(`Kopia wniosku ${nrReferencyjny}: ${dane.nazwa_firmy}`));
  doc.setCreator("Wniosek o ubezpieczenie majątkowe — Aura Expert");
  doc.setProducer("Aura Expert");
  doc.setLanguage("pl-PL");
  const teraz = zlozono ?? new Date();
  doc.setCreationDate(teraz);
  doc.setModificationDate(teraz);

  const s = new Sklad(doc, zwykly, gruby, nrReferencyjny);
  s.nowaStrona();

  // --- Nagłówek: logo, podpis po prawej, niebieska linia ---
  const logo = await doc.embedPng(base64NaBajty(LOGO_PDF));
  const WYS_LOGO = 44;
  const logoWymiary = logo.scale(WYS_LOGO / logo.height);
  const gora = WYS - 36;
  s.strona.drawImage(logo, { x: MARGINES, y: gora - WYS_LOGO, width: logoWymiary.width, height: WYS_LOGO });
  const podpis = oczysc("Ubezpieczenie majątkowe salonów beauty");
  s.strona.drawText(podpis, {
    x: SZER - MARGINES - zwykly.widthOfTextAtSize(podpis, 9),
    y: gora - WYS_LOGO / 2 - 3,
    size: 9,
    font: zwykly,
    color: KOLOR.szary,
  });
  const liniaY = gora - WYS_LOGO - 10;
  s.strona.drawLine({
    start: { x: MARGINES, y: liniaY },
    end: { x: SZER - MARGINES, y: liniaY },
    thickness: 2,
    color: KOLOR.akcent,
  });
  s.y = liniaY - 24;
  s.tekst("Wniosek o ubezpieczenie majątkowe", MARGINES, TRESC, { font: gruby, rozmiar: 17 });
  s.odstep(6);

  // Karta numeru
  const WYS_KARTY = 46;
  s.strona.drawRectangle({
    x: MARGINES,
    y: s.y - WYS_KARTY,
    width: TRESC,
    height: WYS_KARTY,
    color: KOLOR.markaJasna,
    borderColor: KOLOR.markaRamka,
    borderWidth: 0.8,
  });
  s.strona.drawText("Numer wniosku", { x: MARGINES + 12, y: s.y - 15, size: 8, font: zwykly, color: KOLOR.szary });
  s.strona.drawText(oczysc(nrReferencyjny), { x: MARGINES + 12, y: s.y - 34, size: 15, font: gruby, color: KOLOR.marka });
  const kolumnaDaty = MARGINES + TRESC / 2 + 20;
  s.strona.drawText(oczysc("Data złożenia"), { x: kolumnaDaty, y: s.y - 15, size: 8, font: zwykly, color: KOLOR.szary });
  s.strona.drawText(oczysc(zlozono ? dataPl(zlozono) : "—"), {
    x: kolumnaDaty,
    y: s.y - 32,
    size: 11,
    font: gruby,
    color: KOLOR.tekst,
  });
  s.y -= WYS_KARTY + 4;

  // --- 1. Dane ubezpieczającego ---
  s.sekcja("Dane ubezpieczającego");
  s.pola([
    ["Nazwa", dane.nazwa_firmy],
    ["NIP", dane.nip],
    ["REGON", dane.regon],
    ["KRS", dane.krs],
    ["Forma prawna", dane.forma_prawna],
    ["PKD", dane.numer_pkd],
    ["Adres siedziby", dane.adres_siedziby],
    ["E-mail", dane.email_kontaktowy],
    ["Telefon", dane.telefon],
    ["Osoba do kontaktu", [dane.osoba_kontaktu, dane.stanowisko].filter(Boolean).join(", ")],
  ]);

  s.sekcja("Profil działalności");
  s.pola([
    ["Rodzaj działalności", dane.rodzaj_dzialalnosci],
    ["Wykonywane zabiegi", dane.zabiegi.join(", ")],
    ["Liczba pracowników", dane.liczba_pracownikow],
    ["Roczny obrót", dane.roczny_obrot],
  ]);

  s.sekcja("Zakres ubezpieczenia");
  if (dane.zakres.length) {
    for (const z of dane.zakres) s.tekst(`•  ${z}`, MARGINES, TRESC);
  } else {
    s.tekst("nie wskazano", MARGINES, TRESC, { kolor: KOLOR.szaryJasny });
  }

  // --- Lokalizacje ---
  for (const lok of dane.lokalizacje) {
    s.sekcja(tytulLokalizacji(lok));
    s.pola([
      ["Adres", lok.adres],
      ["Typ lokalu", lok.typ_lokalu],
      ["Powierzchnia", lok.powierzchnia ? `${lok.powierzchnia} m²` : ""],
      ["Piętro", lok.pietro],
      ["Rok budowy / remontu", [lok.rok_budowy, lok.rok_remontu].filter(Boolean).join(" / ")],
      ["Ściany / dach", [lok.material_scian, lok.pokrycie_dachu].filter(Boolean).join(" / ")],
      ["Stan techniczny", lok.stan_techniczny],
      ["Ogrzewanie", lok.ogrzewanie],
      ["Własność", lok.budynek_wlasny ? "budynek własny" : "najem"],
      ["Materiały palne w procesie", tak(lok.materialy_palne)],
      [
        "Zabezpieczenia ppoż.",
        listaZabezpieczen([
          lok.gasnice_szt && `gaśnice: ${lok.gasnice_szt} szt.`,
          lok.data_przegladu_gasnic && `przegląd gaśnic: ${lok.data_przegladu_gasnic}`,
          lok.hydranty && "hydranty wewnętrzne",
          lok.sap && "system alarmowania pożaru",
          lok.tryskacze && "tryskacze",
          lok.drogi_ewakuacyjne && "oznakowane drogi ewakuacyjne",
          lok.zakaz_palenia && "zakaz palenia",
          lok.odleglosc_psp && `odległość od PSP: ${lok.odleglosc_psp} km`,
        ]),
      ],
      [
        "Zabezpieczenia antykradzieżowe",
        listaZabezpieczen([
          lok.alarm_typ && lok.alarm_typ !== "brak" && `alarm: ${lok.alarm_typ}`,
          lok.agencja_ochrony && !jestBrak(lok.agencja_ochrony) && `ochrona: ${lok.agencja_ochrony}`,
          lok.agencja_24h && "ochrona 24h",
          lok.cctv && "monitoring CCTV",
          lok.sejf_klasa && lok.sejf_klasa !== "brak" && `sejf kl. ${lok.sejf_klasa}`,
          lok.kraty && "kraty w oknach",
          lok.rolety && "rolety antywłamaniowe",
          lok.zamki_atestowane && "zamki atestowane",
          lok.drzwi_atestowane && "drzwi atestowane",
          lok.szyby_antywlamaniowe && "szyby antywłamaniowe",
          lok.ogrodzenie && "ogrodzenie terenu",
          lok.system_alarmowy && "komputerowy system alarmowy",
        ]),
      ],
      ["Suma lokalizacji", zl(sumaLokalizacji(lok))],
    ]);
  }

  // --- Sumy ubezpieczenia ---
  s.sekcja("Sumy ubezpieczenia");
  const pozycje = POZYCJE_SUM.map((poz) => {
    const wartosci = dane.lokalizacje.map((l) => Number(l[poz.klucz]) || 0);
    return { etykieta: poz.etykieta, wartosci, razem: wartosci.reduce((a, b) => a + b, 0) };
  }).filter((p) => p.razem > 0);
  const wieleLok = dane.lokalizacje.length > 1;
  s.tabela(
    [
      { naglowek: "Kategoria", szer: wieleLok ? 3.2 : 4 },
      ...(wieleLok ? dane.lokalizacje.map((l) => ({ naglowek: `Lok. ${l.nr}`, szer: 1.2, prawo: true })) : []),
      { naglowek: "Razem", szer: 1.4, prawo: true },
    ],
    pozycje.map((p) => [p.etykieta, ...(wieleLok ? p.wartosci.map(zl) : []), zl(p.razem)]),
    ["Łączna suma ubezpieczenia", ...(wieleLok ? dane.lokalizacje.map((l) => zl(sumaLokalizacji(l))) : []), zl(sumaWniosku(dane))],
  );

  // --- Wykazy sprzętu ---
  const tabelaSprzetu = (
    tytul: string,
    pozycje: { lokalizacja: number; nazwa: string; opis: string; wartosc: number }[],
  ) => {
    if (pozycje.length === 0) return;
    s.sekcja(`${tytul} (${pozycje.length})`);
    s.tabela(
      [
        { naglowek: "Lok.", szer: 0.5 },
        { naglowek: "Urządzenie", szer: 2.2 },
        { naglowek: "Producent / model / nr / rok", szer: 2.6 },
        { naglowek: "Wartość", szer: 1.1, prawo: true },
      ],
      pozycje.map((p) => [String(p.lokalizacja), p.nazwa, p.opis, zl(p.wartosc)]),
      ["", "Razem", "", zl(pozycje.reduce((a, p) => a + (Number(p.wartosc) || 0), 0))],
    );
  };
  tabelaSprzetu(
    "Sprzęt medyczny / estetyczny",
    dane.sprzet_medyczny.map((u) => ({
      lokalizacja: u.lokalizacja,
      nazwa: u.nazwa,
      opis: [u.producent, u.model, u.nr_seryjny, u.rok_zakupu, u.cert_ce ? "CE" : "", u.uwagi].filter(Boolean).join(" · "),
      wartosc: u.wartosc,
    })),
  );
  tabelaSprzetu(
    "Sprzęt elektroniczny (EEI)",
    dane.elektronika_eei.map((u) => ({
      lokalizacja: u.lokalizacja,
      nazwa: u.nazwa,
      opis: [u.producent, u.model, u.nr_seryjny, u.rok_zakupu, u.uwagi].filter(Boolean).join(" · "),
      wartosc: u.wartosc,
    })),
  );

  // --- Szkodowość ---
  s.sekcja("Szkodowość (ostatnie 5 lat)");
  if (dane.brak_szkod || dane.szkody.length === 0) {
    s.tekst("Brak szkód w ostatnich 5 latach.", MARGINES, TRESC, { kolor: KOLOR.szary });
  } else {
    s.tabela(
      [
        { naglowek: "Data", szer: 1 },
        { naglowek: "Przyczyna", szer: 2.4 },
        { naglowek: "Ubezpieczyciel", szer: 1.5 },
        { naglowek: "Szkoda", szer: 1.1, prawo: true },
        { naglowek: "Odszkodowanie", szer: 1.2, prawo: true },
      ],
      dane.szkody.map((sz) => [sz.data, sz.przyczyna, sz.ubezpieczyciel, zl(sz.kwota_szkody), zl(sz.odszkodowanie)]),
    );
  }

  // --- Dotychczasowa polisa ---
  s.sekcja("Dotychczasowa polisa");
  if (dane.posiada_polise) {
    s.pola([
      ["Towarzystwo", dane.towarzystwo_obecne],
      ["Numer polisy", dane.nr_polisy_obecny],
      ["Ważność do", dane.waznosc_do],
      ["Roczna składka", dane.roczna_skladka_obecna ? zl(dane.roczna_skladka_obecna) : ""],
    ]);
  } else {
    s.tekst("Brak obecnej polisy mienia.", MARGINES, TRESC, { kolor: KOLOR.szary });
  }

  if (dane.uwagi.trim()) {
    s.sekcja("Uwagi");
    s.tekst(dane.uwagi, MARGINES, TRESC);
  }

  // --- Oświadczenia ---
  s.sekcja("Oświadczenia");
  for (const [tresc, zgoda] of [
    [TRESC_ZGODY.prawdziwosc, dane.zgoda_prawdziwosc],
    [TRESC_ZGODY.rodo, dane.zgoda_rodo],
  ] as const) {
    s.ramka(`[${zgoda ? "X" : "  "}]  ${tresc}  —  ${zgoda ? "TAK" : "NIE"}`, {
      tlo: KOLOR.bialy,
      obramowanie: KOLOR.linia,
    });
  }
  s.pola([
    ["Miejscowość i data", [dane.miejscowosc_podpisu, dane.data_podpisu].filter(Boolean).join(", ")],
  ]);

  // --- Dystrybutor ---
  s.odstep(8);
  s.ramka(
    `Dystrybutor ubezpieczeń: ${DYSTRYBUTOR.nazwa}, ${DYSTRYBUTOR.adres}, ${DYSTRYBUTOR.forma} wpisany do rejestru ` +
      `pośredników ubezpieczeniowych KNF pod nr ${DYSTRYBUTOR.knf} (${DYSTRYBUTOR.rejestrKnf.replace("https://", "")}). ` +
      `KRS ${DYSTRYBUTOR.krs}, NIP ${DYSTRYBUTOR.nip}, REGON ${DYSTRYBUTOR.regon}. ` +
      `Kontakt: ${DYSTRYBUTOR.email}, tel. ${DYSTRYBUTOR.telefon}; reklamacje: ${DYSTRYBUTOR.reklamacje}; ` +
      `inspektor ochrony danych: ${DYSTRYBUTOR.iod}.\n` +
      `Pełną informację o dystrybutorze oraz notę informacyjną RODO przekazujemy razem z tą kopią wniosku. ` +
      `Wniosek nie jest umową ubezpieczenia — na jego podstawie przygotujemy ofertę.`,
    { tlo: KOLOR.markaJasna, obramowanie: KOLOR.markaRamka, rozmiar: 8, kolor: KOLOR.szary },
  );

  // --- Stopka na każdej stronie ---
  const strony = doc.getPages();
  const stopka = oczysc(
    `${DYSTRYBUTOR.nazwa} · ${DYSTRYBUTOR.forma} · KNF ${DYSTRYBUTOR.knf} · KRS ${DYSTRYBUTOR.krs} · NIP ${DYSTRYBUTOR.nip}`,
  );
  strony.forEach((strona, i) => {
    strona.drawLine({
      start: { x: MARGINES, y: 44 },
      end: { x: SZER - MARGINES, y: 44 },
      thickness: 0.5,
      color: KOLOR.linia,
    });
    strona.drawText(stopka, { x: MARGINES, y: 32, size: 7.5, font: zwykly, color: KOLOR.szaryJasny });
    const numer = `Strona ${i + 1} z ${strony.length}`;
    strona.drawText(numer, {
      x: SZER - MARGINES - zwykly.widthOfTextAtSize(numer, 7.5),
      y: 32,
      size: 7.5,
      font: zwykly,
      color: KOLOR.szaryJasny,
    });
  });

  return doc.save();
}
