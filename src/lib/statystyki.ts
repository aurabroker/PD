import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import {
  FORMA_PRAWNA,
  LICZBA_PRACOWNIKOW,
  POWODY_REZYGNACJI,
  POZYCJE_SUM,
  ROCZNY_OBROT,
  STATUS,
  STATUSY_OTWARTE,
  STATUSY_Z_OFERTA,
  TYP_LOKALU,
  ZAKRES,
  type Status,
} from "./slowniki";

/**
 * Liczby dla panelu: liczniki na stronie głównej i zakładka Statystyki.
 * Agregujemy w kodzie, nie w SQL — przy setkach/tysiącach wniosków to ułamek
 * sekundy, a logika (lejek, alerty) zostaje w jednym, testowalnym miejscu.
 */

const KOLUMNY_WNIOSKU = [
  "id", "nr_referencyjny", "nazwa_firmy", "nip", "email_kontaktowy", "telefon", "updated_at",
  "status", "zrodlo", "przypisany_agent", "suma_lacznie",
  ...POZYCJE_SUM.map((p) => p.klucz),
  "zakres", "forma_prawna", "liczba_pracownikow", "roczny_obrot",
  "brak_szkod", "szkody", "sprzet_medyczny", "elektronika_eei",
  "posiada_polise", "waznosc_do", "towarzystwo_obecne", "roczna_skladka_obecna",
  "oferta_towarzystwo", "oferta_skladka", "polisa_skladka", "polisa_do", "rezygnacja_powod",
  "import_zgodnosc", "created_at", "wyslano_at", "status_zmieniony_at",
].join(", ");

type Szkoda = { kwota_szkody?: number; odszkodowanie?: number };
type Urzadzenie = { wartosc?: number };

export type WierszWniosku = {
  id: string;
  nr_referencyjny: string;
  nazwa_firmy: string | null;
  nip: string | null;
  email_kontaktowy: string | null;
  telefon: string | null;
  updated_at: string;
  status: Status;
  zrodlo: string;
  przypisany_agent: string | null;
  suma_lacznie: number | null;
  zakres: string[] | null;
  forma_prawna: string | null;
  liczba_pracownikow: string | null;
  roczny_obrot: string | null;
  brak_szkod: boolean | null;
  szkody: Szkoda[] | null;
  sprzet_medyczny: Urzadzenie[] | null;
  elektronika_eei: Urzadzenie[] | null;
  posiada_polise: boolean | null;
  waznosc_do: string | null;
  towarzystwo_obecne: string | null;
  roczna_skladka_obecna: number | null;
  oferta_towarzystwo: string | null;
  oferta_skladka: number | null;
  polisa_skladka: number | null;
  polisa_do: string | null;
  rezygnacja_powod: string | null;
  import_zgodnosc: { zgodny?: boolean } | null;
  created_at: string;
  wyslano_at: string | null;
  status_zmieniony_at: string | null;
} & Record<(typeof POZYCJE_SUM)[number]["klucz"], number | null>;

type WierszLokalizacji = {
  wniosek_id: string;
  typ_lokalu: string | null;
  budynek_wlasny: boolean | null;
  alarm_typ: string | null;
  cctv: boolean | null;
  agencja_24h: boolean | null;
  sap: boolean | null;
  tryskacze: boolean | null;
};

/** Pobiera wszystkie wiersze stronami — Supabase zwraca najwyżej 1000 na zapytanie. */
async function wszystkie<T>(tabela: string, kolumny: string): Promise<T[]> {
  const STRONA = 1000;
  const wynik: T[] = [];
  for (let od = 0; ; od += STRONA) {
    const { data, error } = await supabaseAdmin()
      .from(tabela)
      .select(kolumny)
      .order("id")
      .range(od, od + STRONA - 1);
    if (error) throw new Error(`Odczyt ${tabela}: ${error.message}`);
    wynik.push(...((data ?? []) as T[]));
    if (!data || data.length < STRONA) return wynik;
  }
}

export async function pobierzWnioski(): Promise<WierszWniosku[]> {
  return wszystkie<WierszWniosku>("mienie_wnioski", KOLUMNY_WNIOSKU);
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
const DZIEN = 24 * 60 * 60 * 1000;

/** Data „RRRR-MM-DD” albo „DD.MM.RRRR” z pola tekstowego — null gdy nieczytelna. */
function data(v: string | null | undefined): Date | null {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const pl = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  const d = iso ? new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`) : pl ? new Date(`${pl[3]}-${pl[2].padStart(2, "0")}-${pl[1].padStart(2, "0")}T12:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const otwarty = (w: WierszWniosku) => (STATUSY_OTWARTE as readonly string[]).includes(w.status);
const zOferta = (w: WierszWniosku) => (STATUSY_Z_OFERTA as readonly string[]).includes(w.status) || w.oferta_skladka != null;

export type Liczniki = {
  robocze: number;
  zlozone: number;
  czekajace: number;
  wOcenie: number;
  oferty: number;
  polisy: number;
  rezygnacje: number;
  odrzucone: number;
  nowe7dni: number;
  konwersja: number | null;
  skladkaPolis: number;
  sumaWToku: number;
  uwaga: {
    nieprzypisane: number;
    czekajaPonad2Dni: number;
    plikNiezgodny: number;
    polisaKlientaWygasa30: number;
    odnowienia60: number;
  };
};

/** Liczniki strony głównej panelu. */
export function policzLiczniki(wnioski: WierszWniosku[], teraz = new Date()): Liczniki {
  const t = teraz.getTime();
  const status = (s: Status) => wnioski.filter((w) => w.status === s).length;
  const zlozone = wnioski.filter((w) => w.status !== "roboczy");
  const oferty = zlozone.filter(zOferta).length;
  const polisy = status("polisa");

  return {
    robocze: status("roboczy"),
    zlozone: zlozone.length,
    czekajace: status("zlozony"),
    wOcenie: status("w_ocenie"),
    oferty,
    polisy,
    rezygnacje: status("rezygnacja"),
    odrzucone: status("odrzucony"),
    nowe7dni: zlozone.filter((w) => w.wyslano_at && t - new Date(w.wyslano_at).getTime() < 7 * DZIEN).length,
    konwersja: oferty > 0 ? polisy / oferty : null,
    skladkaPolis: wnioski.filter((w) => w.status === "polisa").reduce((a, w) => a + n(w.polisa_skladka), 0),
    sumaWToku: wnioski.filter(otwarty).reduce((a, w) => a + n(w.suma_lacznie), 0),
    uwaga: {
      nieprzypisane: wnioski.filter((w) => otwarty(w) && !w.przypisany_agent).length,
      czekajaPonad2Dni: wnioski.filter(
        (w) => w.status === "zlozony" && t - new Date(w.status_zmieniony_at ?? w.wyslano_at ?? w.created_at).getTime() > 2 * DZIEN,
      ).length,
      plikNiezgodny: wnioski.filter((w) => otwarty(w) && w.import_zgodnosc?.zgodny === false).length,
      polisaKlientaWygasa30: wnioski.filter((w) => {
        const d = otwarty(w) && w.posiada_polise ? data(w.waznosc_do) : null;
        return d != null && d.getTime() >= t - DZIEN && d.getTime() - t <= 30 * DZIEN;
      }).length,
      odnowienia60: wnioski.filter((w) => {
        const d = w.status === "polisa" ? data(w.polisa_do) : null;
        return d != null && d.getTime() >= t - DZIEN && d.getTime() - t <= 60 * DZIEN;
      }).length,
    },
  };
}

/** Filtry listy odpowiadające alertom „wymaga uwagi” — ta sama logika co w licznikach. */
export function pasujeDoAlertu(w: WierszWniosku, alert: keyof Liczniki["uwaga"], teraz = new Date()): boolean {
  const jeden = policzLiczniki([w], teraz).uwaga;
  return jeden[alert] > 0;
}

// ---------------------------------------------------------------------------

export type Okres = "30" | "90" | "365" | "wszystko";

export type Rozklad = { etykieta: string; liczba: number; udzial: number }[];

export type Statystyki = {
  okres: Okres;
  liczba: number;
  sumaLacznie: number;
  sredniaSuma: number;
  medianaSumy: number;
  lokalizacje: number;
  polisy: number;
  oferty: number;
  konwersja: number | null;
  skladkaPolis: number;
  sredniaSkladka: number;
  kategorie: { klucz: string; etykieta: string; suma: number; udzial: number }[];
  zakres: Rozklad;
  lejek: Rozklad;
  powodyRezygnacji: Rozklad;
  formaPrawna: Rozklad;
  pracownicy: Rozklad;
  obrot: Rozklad;
  zrodlo: Rozklad;
  typLokalu: Rozklad;
  ryzyko: {
    zeSzkodami: number;
    liczbaSzkod: number;
    sumaOdszkodowan: number;
    zabezpieczenia: { etykieta: string; liczba: number; udzial: number }[];
    budynekWlasny: number;
  };
  sprzet: { medyczny: { sztuk: number; wartosc: number }; eei: { sztuk: number; wartosc: number } };
  obecnePolisy: { udzial: number; sredniaSkladka: number; towarzystwa: Rozklad };
  towarzystwaOfert: Rozklad;
  trend: { miesiac: string; zlozone: number; polisy: number }[];
};

function rozklad(wartosci: (string | null | undefined)[], kolejnosc?: readonly string[]): Rozklad {
  const liczby = new Map<string, number>();
  for (const v of wartosci) {
    const k = (v ?? "").trim() || "nie podano";
    liczby.set(k, (liczby.get(k) ?? 0) + 1);
  }
  const suma = wartosci.length || 1;
  const klucze = kolejnosc
    ? [...kolejnosc.filter((k) => liczby.has(k)), ...[...liczby.keys()].filter((k) => !kolejnosc.includes(k))]
    : [...liczby.keys()].sort((a, b) => (liczby.get(b) ?? 0) - (liczby.get(a) ?? 0));
  return klucze.map((k) => ({ etykieta: k, liczba: liczby.get(k) ?? 0, udzial: (liczby.get(k) ?? 0) / suma }));
}

/** Nazwa towarzystwa ujednolicona do zliczania („pzu s.a.” = „PZU”). */
const towarzystwo = (v: string | null) =>
  v ? v.trim().replace(/\s+(s\.?\s?a\.?|tuir|tu)$/i, "").toUpperCase() || null : null;

export async function policzStatystyki(okres: Okres, teraz = new Date()): Promise<Statystyki> {
  const [wszystkieWnioski, lokalizacje] = await Promise.all([
    pobierzWnioski(),
    wszystkie<WierszLokalizacji>(
      "mienie_lokalizacje",
      "id, wniosek_id, typ_lokalu, budynek_wlasny, alarm_typ, cctv, agencja_24h, sap, tryskacze",
    ),
  ]);

  const od = okres === "wszystko" ? 0 : teraz.getTime() - Number(okres) * DZIEN;
  const w = wszystkieWnioski.filter(
    (x) => x.status !== "roboczy" && new Date(x.wyslano_at ?? x.created_at).getTime() >= od,
  );
  const ids = new Set(w.map((x) => x.id));
  const lok = lokalizacje.filter((l) => ids.has(l.wniosek_id));

  const sumy = w.map((x) => n(x.suma_lacznie)).sort((a, b) => a - b);
  const sumaLacznie = sumy.reduce((a, b) => a + b, 0);
  const polisy = w.filter((x) => x.status === "polisa");
  const oferty = w.filter(zOferta).length;
  const skladkaPolis = polisy.reduce((a, x) => a + n(x.polisa_skladka), 0);

  const kategorie = POZYCJE_SUM.map((p) => {
    const suma = w.reduce((a, x) => a + n(x[p.klucz]), 0);
    return { klucz: p.klucz, etykieta: p.etykieta, suma, udzial: sumaLacznie ? suma / sumaLacznie : 0 };
  }).sort((a, b) => b.suma - a.suma);

  const zakres: Rozklad = ZAKRES.map((z) => {
    const liczba = w.filter((x) => (x.zakres ?? []).includes(z)).length;
    return { etykieta: z, liczba, udzial: w.length ? liczba / w.length : 0 };
  });

  const szkody = w.flatMap((x) => (x.brak_szkod ? [] : x.szkody ?? []));
  const udzialLok = (f: (l: WierszLokalizacji) => boolean) => (lok.length ? lok.filter(f).length / lok.length : 0);
  const zabezpieczenie = (etykieta: string, f: (l: WierszLokalizacji) => boolean) => {
    const liczba = lok.filter(f).length;
    return { etykieta, liczba, udzial: lok.length ? liczba / lok.length : 0 };
  };
  const urzadzenia = (k: "sprzet_medyczny" | "elektronika_eei") => {
    const lista = w.flatMap((x) => x[k] ?? []);
    return { sztuk: lista.length, wartosc: lista.reduce((a, u) => a + n(u.wartosc), 0) };
  };
  const zPolisa = w.filter((x) => x.posiada_polise);

  // Trend: ostatnie 12 miesięcy kalendarzowych (niezależnie od filtra okresu).
  const trend: Statystyki["trend"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(teraz.getUTCFullYear(), teraz.getUTCMonth() - i, 1));
    const klucz = d.toISOString().slice(0, 7);
    const wMiesiacu = (iso: string | null) => (iso ?? "").slice(0, 7) === klucz;
    trend.push({
      miesiac: klucz,
      zlozone: wszystkieWnioski.filter((x) => x.status !== "roboczy" && wMiesiacu(x.wyslano_at)).length,
      polisy: wszystkieWnioski.filter((x) => x.status === "polisa" && wMiesiacu(x.status_zmieniony_at)).length,
    });
  }

  return {
    okres,
    liczba: w.length,
    sumaLacznie,
    sredniaSuma: w.length ? sumaLacznie / w.length : 0,
    medianaSumy: sumy.length ? (sumy.length % 2 ? sumy[(sumy.length - 1) / 2] : (sumy[sumy.length / 2 - 1] + sumy[sumy.length / 2]) / 2) : 0,
    lokalizacje: lok.length,
    polisy: polisy.length,
    oferty,
    konwersja: oferty ? polisy.length / oferty : null,
    skladkaPolis,
    sredniaSkladka: polisy.length ? skladkaPolis / polisy.length : 0,
    kategorie,
    zakres,
    lejek: rozklad(w.map((x) => x.status), STATUS),
    powodyRezygnacji: rozklad(w.filter((x) => x.status === "rezygnacja").map((x) => x.rezygnacja_powod), POWODY_REZYGNACJI),
    formaPrawna: rozklad(w.map((x) => x.forma_prawna), FORMA_PRAWNA),
    pracownicy: rozklad(w.map((x) => x.liczba_pracownikow), LICZBA_PRACOWNIKOW),
    obrot: rozklad(w.map((x) => x.roczny_obrot), ROCZNY_OBROT),
    zrodlo: rozklad(w.map((x) => (x.zrodlo === "excel" ? "plik Excel" : x.zrodlo === "agent" ? "agent" : "formularz www"))),
    typLokalu: rozklad(lok.map((l) => l.typ_lokalu), TYP_LOKALU),
    ryzyko: {
      zeSzkodami: w.filter((x) => !x.brak_szkod && (x.szkody ?? []).length > 0).length,
      liczbaSzkod: szkody.length,
      sumaOdszkodowan: szkody.reduce((a, s) => a + n(s.odszkodowanie), 0),
      zabezpieczenia: [
        zabezpieczenie("Alarm z monitoringiem", (l) => /monitoring/i.test(l.alarm_typ ?? "")),
        zabezpieczenie("Agencja ochrony 24h", (l) => Boolean(l.agencja_24h)),
        zabezpieczenie("Monitoring wizyjny (CCTV)", (l) => Boolean(l.cctv)),
        zabezpieczenie("System alarmowania pożaru (SAP)", (l) => Boolean(l.sap)),
        zabezpieczenie("Tryskacze", (l) => Boolean(l.tryskacze)),
      ],
      budynekWlasny: udzialLok((l) => Boolean(l.budynek_wlasny)),
    },
    sprzet: { medyczny: urzadzenia("sprzet_medyczny"), eei: urzadzenia("elektronika_eei") },
    obecnePolisy: {
      udzial: w.length ? zPolisa.length / w.length : 0,
      sredniaSkladka: zPolisa.length ? zPolisa.reduce((a, x) => a + n(x.roczna_skladka_obecna), 0) / zPolisa.length : 0,
      towarzystwa: rozklad(zPolisa.map((x) => towarzystwo(x.towarzystwo_obecne))),
    },
    towarzystwaOfert: rozklad(w.filter(zOferta).map((x) => towarzystwo(x.oferta_towarzystwo))),
    trend,
  };
}

export type AgentSkrot = { user_id: string; email: string; imie_nazwisko: string; rola: string; aktywny: boolean };

export async function pobierzAgentow(): Promise<AgentSkrot[]> {
  const { data, error } = await supabaseAdmin()
    .from("mienie_agenci")
    .select("user_id, email, imie_nazwisko, rola, aktywny")
    .order("imie_nazwisko");
  if (error) throw new Error(`Odczyt agentów: ${error.message}`);
  return (data ?? []) as AgentSkrot[];
}

export const nazwaAgenta = (a: Pick<AgentSkrot, "imie_nazwisko" | "email"> | undefined) =>
  a ? a.imie_nazwisko || a.email : "—";
