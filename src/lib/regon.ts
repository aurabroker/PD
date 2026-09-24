import "server-only";
import { FORMA_PRAWNA } from "./slowniki";

/**
 * Klient GUS BIR1.1 — weryfikacja firmy po NIP w bazie REGON.
 *
 * API jest SOAP 1.2 z WS-Addressing i sesją: Zaloguj (klucz → sid), potem
 * wywołania z sid w nagłówku HTTP, na końcu Wyloguj. Wyniki to XML
 * zaszyfrowany (escaped) w treści odpowiedzi.
 *
 * Przebieg:
 *  1. DaneSzukajPodmioty po NIP — nazwa, adres, REGON, typ podmiotu.
 *  2. DanePobierzPelnyRaport, raport główny — forma prawna, numer w rejestrze
 *     (KRS), data rozpoczęcia / zawieszenia, e-mail, telefon, www.
 *  3. DanePobierzPelnyRaport, raport PKD — PKD przeważające i pozostałe.
 * Raporty 2–3 są best-effort: ich błąd nie unieważnia wyniku z kroku 1.
 *
 * Bez GUS_BIR_KEY używamy publicznego klucza testowego i rejestru testowego
 * GUS (dane testowe). Sekret Workera GUS_BIR_KEY przełącza na produkcję.
 */

const NS = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  ns: "http://CIS/BIR/PUBL/2014/07",
  dat: "http://CIS/BIR/PUBL/2014/07/DataContract",
};
const AKCJA = "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl";
const AKCJA_RAPORT = "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DanePobierzPelnyRaport";
const KLUCZ_TESTOWY = "abcde12345abcde12345";

function konfiguracja(): { klucz: string; endpoint: string; test: boolean } {
  const klucz = process.env.GUS_BIR_KEY;
  if (klucz) {
    return {
      klucz,
      endpoint: "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc",
      test: false,
    };
  }
  return {
    klucz: KLUCZ_TESTOWY,
    endpoint: "https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc",
    test: true,
  };
}

export type Pkd = { kod: string; nazwa: string; przewazajace: boolean };

export type DaneRegon = {
  regon: string;
  nip: string;
  nazwa: string;
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  miejscowosc: string;
  kod_pocztowy: string;
  ulica: string;
  nr_nieruchomosci: string;
  nr_lokalu: string;
  typ: string;
  silos_id: string;
  data_zakonczenia: string;
  aktywna: boolean;
  adres: string;
  // z raportu glownego
  forma_prawna_gus: string;
  forma_prawna: (typeof FORMA_PRAWNA)[number] | "";
  krs: string;
  data_rozpoczecia: string;
  zawieszona: boolean;
  email: string;
  telefon: string;
  www: string;
  // z raportu PKD
  pkd: Pkd[];
  pkd_glowne: Pkd | null;
  test: boolean;
};

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const odszyfruj = (v: string) =>
  v
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/** Buduje kopertę SOAP 1.2 z WS-Addressing. */
export function kopertaSoap(endpoint: string, akcja: string, cialo: string): string {
  return (
    `<soap:Envelope xmlns:soap="${NS.soap}" xmlns:wsa="${NS.wsa}" xmlns:ns="${NS.ns}" xmlns:dat="${NS.dat}">` +
    `<soap:Header>` +
    `<wsa:To>${endpoint}</wsa:To>` +
    `<wsa:Action>${akcja}</wsa:Action>` +
    `</soap:Header>` +
    `<soap:Body>${cialo}</soap:Body>` +
    `</soap:Envelope>`
  );
}

async function wywolaj(
  endpoint: string,
  akcja: string,
  cialo: string,
  sid?: string,
): Promise<string> {
  const naglowki: Record<string, string> = {
    "Content-Type": `application/soap+xml; charset=utf-8; action="${akcja}"`,
  };
  if (sid) naglowki["sid"] = sid;

  const odp = await fetch(endpoint, {
    method: "POST",
    headers: naglowki,
    body: kopertaSoap(endpoint, akcja, cialo),
  });
  if (!odp.ok) throw new Error(`GUS BIR HTTP ${odp.status}`);
  return await odp.text();
}

/** Zawartość znacznika o dokładnej nazwie (pierwsze wystąpienie). */
function tag(xml: string, nazwa: string): string {
  const m = xml.match(new RegExp(`<${nazwa}(?:\\s[^>]*)?>([\\s\\S]*?)</${nazwa}>`, "i"));
  return m ? odszyfruj(m[1]) : "";
}

/**
 * Pole raportu po końcówce nazwy. Raporty GUS poprzedzają pola prefiksem typu
 * podmiotu (praw_, fiz_, lokpraw_, lokfiz_), a raporty PKD osób fizycznych
 * mają dodatkowe podkreślenie (fiz_pkd_Kod zamiast praw_pkdKod) — wzorzec
 * `sufiks` to fragment wyrażenia regularnego dopasowany po prefiksie.
 */
function pole(xml: string, sufiks: string): string {
  const m = xml.match(new RegExp(`<([a-z]+_${sufiks})(?:\\s[^>]*)?>([\\s\\S]*?)</\\1>`, "i"));
  return m ? odszyfruj(m[2]) : "";
}

/** Bloki <dane>…</dane> z wyniku (raport PKD ma ich wiele). */
function bloki(xml: string): string[] {
  return [...xml.matchAll(/<dane>([\s\S]*?)<\/dane>/gi)].map((m) => m[1]);
}

const bezOgonkow = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/gi, "l").toUpperCase();

/** GUS podaje PKD jako „9602Z" — formularz i szablon używają „96.02.Z". */
export function formatujPkd(kod: string): string {
  const k = kod.replace(/[\s.]/g, "").toUpperCase();
  const m = k.match(/^(\d{2})(\d{2})([A-Z])$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : kod.trim();
}

/** Nazwa formy prawnej z GUS → pozycja słownika formularza. */
export function mapujFormePrawna(nazwaGus: string, typ: string): DaneRegon["forma_prawna"] {
  const n = bezOgonkow(nazwaGus);
  const t = typ.toUpperCase();
  if (t === "F" || t === "LF" || n.includes("OSOBY FIZYCZNE")) return "Jednoosobowa działalność gospodarcza";
  if (!n) return "";
  if (n.includes("CYWILN")) return "Spółka cywilna";
  if (n.includes("OGRANICZONA ODPOWIEDZIALNOSCIA")) return "Spółka z o.o.";
  if (n.includes("KOMANDYTOWO-AKCYJN")) return "Inne";
  if (n.includes("KOMANDYTOW")) return "Spółka komandytowa";
  if (n.includes("AKCYJN")) return "Spółka akcyjna";
  if (n.includes("JAWN")) return "Spółka jawna";
  return "Inne";
}

/** Nazwy raportów pełnych dla typu podmiotu i silosu (ewidencji) z wyszukiwania. */
export function raportyDla(typ: string, silosId: string): { glowny: string; pkd: string } | null {
  switch (typ.toUpperCase()) {
    case "P":
      return { glowny: "BIR11OsPrawna", pkd: "BIR11OsPrawnaPkd" };
    case "LP":
      return { glowny: "BIR11JednLokalnaOsPrawnej", pkd: "BIR11JednLokalnaOsPrawnejPkd" };
    case "LF":
      return { glowny: "BIR11JednLokalnaOsFizycznej", pkd: "BIR11JednLokalnaOsFizycznejPkd" };
    case "F": {
      const glowny =
        {
          "1": "BIR11OsFizycznaDzialalnoscCeidg",
          "2": "BIR11OsFizycznaDzialalnoscRolnicza",
          "3": "BIR11OsFizycznaDzialalnoscPozostala",
          "4": "BIR11OsFizycznaDzialalnoscSkreslonaDo20141108",
        }[silosId] ?? "BIR11OsFizycznaDzialalnoscCeidg";
      return { glowny, pkd: "BIR11OsFizycznaPkd" };
    }
    default:
      return null;
  }
}

type Glowny = Pick<
  DaneRegon,
  "forma_prawna_gus" | "krs" | "data_rozpoczecia" | "zawieszona" | "email" | "telefon" | "www"
> & { data_zakonczenia: string };

export function parsujRaportGlowny(xml: string): Glowny | null {
  const d = bloki(xml)[0];
  if (!d || /ErrorCode/i.test(d)) return null;

  const szczegolna = pole(d, "szczegolnaFormaPrawna_Nazwa");
  const podstawowa = pole(d, "podstawowaFormaPrawna_Nazwa");
  const rejestr = bezOgonkow(pole(d, "rodzajRejestruEwidencji_Nazwa"));
  const organ = bezOgonkow(pole(d, "organRejestrowy_Nazwa"));
  const numer = pole(d, "numerWRejestrzeEwidencji");
  // Numer to KRS, gdy rejestr prowadzi sad (Rejestr Przedsiebiorcow / Stowarzyszen KRS).
  // Numer CEIDG albo ewidencji gminnej nim nie jest.
  const zKrs =
    /\bSAD\b|SADOW/.test(organ) || /REJESTR PRZEDSIEBIORCOW|REJESTR STOWARZYSZEN|SADOW/.test(rejestr);

  const zawieszenie = pole(d, "dataZawieszeniaDzialalnosci");
  const wznowienie = pole(d, "dataWznowieniaDzialalnosci");

  return {
    forma_prawna_gus: szczegolna || podstawowa,
    krs: zKrs ? numer : "",
    data_rozpoczecia: pole(d, "dataRozpoczeciaDzialalnosci"),
    zawieszona: Boolean(zawieszenie) && (!wznowienie || wznowienie < zawieszenie),
    data_zakonczenia: pole(d, "dataZakonczeniaDzialalnosci") || pole(d, "dataSkresleniazRegon"),
    email: pole(d, "adresEmail"),
    telefon: pole(d, "numerTelefonu"),
    www: pole(d, "adresStronyinternetowej"),
  };
}

export function parsujPkd(xml: string): Pkd[] {
  const lista: Pkd[] = [];
  for (const d of bloki(xml)) {
    if (/ErrorCode/i.test(d)) continue;
    const kod = pole(d, "pkd_?Kod");
    if (!kod) continue;
    lista.push({
      kod: formatujPkd(kod),
      nazwa: pole(d, "pkd_?Nazwa"),
      przewazajace: pole(d, "pkd_?Przewazajace") === "1",
    });
  }
  // Przewazajace na poczatek, reszta w kolejnosci z rejestru.
  return lista.sort((a, b) => Number(b.przewazajace) - Number(a.przewazajace));
}

type Podstawowe = Omit<
  DaneRegon,
  keyof Glowny | "forma_prawna" | "pkd" | "pkd_glowne" | "test"
> & { data_zakonczenia: string };

export function parsujDaneSzukaj(xmlWewnetrzny: string): Podstawowe | null {
  const d = bloki(xmlWewnetrzny)[0];
  if (!d || /ErrorCode/i.test(d)) return null;
  const regon = tag(d, "Regon");
  const nazwa = tag(d, "Nazwa");
  if (!regon && !nazwa) return null;

  const ulica = tag(d, "Ulica");
  const nrN = tag(d, "NrNieruchomosci");
  const nrL = tag(d, "NrLokalu");
  const kod = tag(d, "KodPocztowy");
  const miejscowosc = tag(d, "Miejscowosc");
  const dataZak = tag(d, "DataZakonczeniaDzialalnosci");

  // Kod pocztowy z bazy bywa bez myślnika (00120 → 00-120).
  const kodF = /^\d{5}$/.test(kod) ? `${kod.slice(0, 2)}-${kod.slice(2)}` : kod;
  const liniaUlica = [ulica, nrN && `${nrN}${nrL ? `/${nrL}` : ""}`].filter(Boolean).join(" ");
  const adres = [liniaUlica, [kodF, miejscowosc].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return {
    regon,
    nip: tag(d, "Nip"),
    nazwa,
    wojewodztwo: tag(d, "Wojewodztwo"),
    powiat: tag(d, "Powiat"),
    gmina: tag(d, "Gmina"),
    miejscowosc,
    kod_pocztowy: kodF,
    ulica,
    nr_nieruchomosci: nrN,
    nr_lokalu: nrL,
    typ: tag(d, "Typ"),
    silos_id: tag(d, "SilosID"),
    data_zakonczenia: dataZak,
    aktywna: dataZak === "",
    adres,
  };
}

export type WynikRegon =
  | { ok: true; dane: DaneRegon }
  | { ok: false; blad: string };

async function raport(endpoint: string, sid: string, regon: string, nazwa: string): Promise<string> {
  const odp = await wywolaj(
    endpoint,
    AKCJA_RAPORT,
    `<ns:DanePobierzPelnyRaport><ns:pRegon>${esc(regon)}</ns:pRegon><ns:pNazwaRaportu>${nazwa}</ns:pNazwaRaportu></ns:DanePobierzPelnyRaport>`,
    sid,
  );
  return tag(odp, "DanePobierzPelnyRaportResult");
}

/** Weryfikuje firmę po NIP w bazie REGON. NIP: 10 cyfr (mogą być z myślnikami). */
export async function weryfikujRegon(nipSurowy: string): Promise<WynikRegon> {
  const nip = (nipSurowy ?? "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(nip)) {
    return { ok: false, blad: "Podaj poprawny NIP (10 cyfr)." };
  }

  const { klucz, endpoint, test } = konfiguracja();
  let sid = "";
  try {
    // 1. Zaloguj → sid
    const odpZaloguj = await wywolaj(
      endpoint,
      `${AKCJA}/Zaloguj`,
      `<ns:Zaloguj><ns:pKluczUzytkownika>${esc(klucz)}</ns:pKluczUzytkownika></ns:Zaloguj>`,
    );
    sid = tag(odpZaloguj, "ZalogujResult");
    if (!sid) return { ok: false, blad: "Nie udało się połączyć z rejestrem REGON. Spróbuj później." };

    // 2. Wyszukanie po NIP
    const odpSzukaj = await wywolaj(
      endpoint,
      `${AKCJA}/DaneSzukajPodmioty`,
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
      sid,
    );
    const podstawowe = parsujDaneSzukaj(tag(odpSzukaj, "DaneSzukajPodmiotyResult"));
    if (!podstawowe) return { ok: false, blad: "Nie znaleziono firmy o tym NIP w bazie REGON." };

    const dane: DaneRegon = {
      ...podstawowe,
      forma_prawna_gus: "",
      forma_prawna: mapujFormePrawna("", podstawowe.typ),
      krs: "",
      data_rozpoczecia: "",
      zawieszona: false,
      email: "",
      telefon: "",
      www: "",
      pkd: [],
      pkd_glowne: null,
      test,
    };

    // 3. Raporty pelne — best-effort, blad nie psuje wyniku wyszukiwania.
    const raporty = raportyDla(podstawowe.typ, podstawowe.silos_id);
    if (raporty && podstawowe.regon) {
      const [glowny, pkd] = await Promise.allSettled([
        raport(endpoint, sid, podstawowe.regon, raporty.glowny),
        raport(endpoint, sid, podstawowe.regon, raporty.pkd),
      ]);

      if (glowny.status === "fulfilled") {
        const g = parsujRaportGlowny(glowny.value);
        if (g) {
          dane.forma_prawna_gus = g.forma_prawna_gus;
          dane.forma_prawna = mapujFormePrawna(g.forma_prawna_gus, podstawowe.typ);
          dane.krs = g.krs;
          dane.data_rozpoczecia = g.data_rozpoczecia;
          dane.zawieszona = g.zawieszona;
          dane.email = g.email;
          dane.telefon = g.telefon;
          dane.www = g.www;
          if (g.data_zakonczenia && !dane.data_zakonczenia) {
            dane.data_zakonczenia = g.data_zakonczenia;
            dane.aktywna = false;
          }
        } else {
          console.error("[regon] raport glowny bez danych:", raporty.glowny, glowny.value.slice(0, 300));
        }
      } else {
        console.error("[regon] raport glowny:", glowny.reason);
      }

      if (pkd.status === "fulfilled") {
        dane.pkd = parsujPkd(pkd.value);
        dane.pkd_glowne = dane.pkd.find((p) => p.przewazajace) ?? dane.pkd[0] ?? null;
      } else {
        console.error("[regon] raport PKD:", pkd.reason);
      }
    }

    return { ok: true, dane };
  } catch (e) {
    console.error("[regon] blad:", e);
    return { ok: false, blad: "Rejestr REGON jest chwilowo niedostępny. Spróbuj ponownie później." };
  } finally {
    // 4. Wyloguj (best-effort)
    if (sid) {
      try {
        await wywolaj(
          endpoint,
          `${AKCJA}/Wyloguj`,
          `<ns:Wyloguj><ns:pIdentyfikatorSesji>${esc(sid)}</ns:pIdentyfikatorSesji></ns:Wyloguj>`,
          sid,
        );
      } catch {
        // wylogowanie nieudane nie wpływa na wynik
      }
    }
  }
}

/**
 * Test połączenia dla zakładki Health: samo Zaloguj/Wyloguj, bez wyszukiwania.
 * GUS przy złym kluczu zwraca pustą sesję, a nie błąd HTTP — sprawdzamy sid.
 */
export async function sprawdzPolaczenieGus(): Promise<{ ok: boolean; test: boolean; opis: string }> {
  const { klucz, endpoint, test } = konfiguracja();
  try {
    const odp = await wywolaj(
      endpoint,
      `${AKCJA}/Zaloguj`,
      `<ns:Zaloguj><ns:pKluczUzytkownika>${esc(klucz)}</ns:pKluczUzytkownika></ns:Zaloguj>`,
    );
    const sid = tag(odp, "ZalogujResult");
    if (!sid) return { ok: false, test, opis: "GUS odrzucił klucz (pusta sesja) — sprawdź GUS_BIR_KEY." };
    await wywolaj(
      endpoint,
      `${AKCJA}/Wyloguj`,
      `<ns:Wyloguj><ns:pIdentyfikatorSesji>${esc(sid)}</ns:pIdentyfikatorSesji></ns:Wyloguj>`,
      sid,
    ).catch(() => {});
    return {
      ok: true,
      test,
      opis: test ? "Działa, ale na rejestrze TESTOWYM — brak GUS_BIR_KEY." : "Rejestr produkcyjny, logowanie kluczem działa.",
    };
  } catch (e) {
    return { ok: false, test, opis: `Brak połączenia z GUS: ${e instanceof Error ? e.message : String(e)}` };
  }
}
