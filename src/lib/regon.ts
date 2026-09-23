import "server-only";

/**
 * Klient GUS BIR1.1 — weryfikacja firmy po NIP w bazie REGON.
 *
 * API jest SOAP 1.2 z WS-Addressing i sesją: najpierw Zaloguj (klucz → sid),
 * potem DaneSzukajPodmioty z sid w nagłówku HTTP, na końcu Wyloguj. Wynik
 * wyszukiwania to XML zaszyfrowany (escaped) w treści odpowiedzi.
 *
 * Bez GUS_BIR_KEY używamy publicznego klucza testowego i rejestru testowego
 * GUS — działa jako demo, ale zwraca dane testowe. Prawdziwy klucz (sekret
 * Workera GUS_BIR_KEY) przełącza na rejestr produkcyjny.
 */

const NS = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  ns: "http://CIS/BIR/PUBL/2014/07",
  dat: "http://CIS/BIR/PUBL/2014/07/DataContract",
};
const AKCJA = "http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl";
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
  data_zakonczenia: string;
  aktywna: boolean;
  adres: string;
  test: boolean;
};

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

/** Wyciąga zawartość pojedynczego znacznika (pierwsze wystąpienie). */
function tag(xml: string, nazwa: string): string {
  const m = xml.match(new RegExp(`<${nazwa}[^>]*>([\\s\\S]*?)</${nazwa}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function parsujDaneSzukaj(xmlWewnetrzny: string): DaneRegon | null {
  const blok = xmlWewnetrzny.match(/<dane>([\s\S]*?)<\/dane>/i);
  if (!blok) return null;
  const d = blok[1];
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
    data_zakonczenia: dataZak,
    aktywna: dataZak === "",
    adres,
    test: false,
  };
}

export type WynikRegon =
  | { ok: true; dane: DaneRegon }
  | { ok: false; blad: string };

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

    // 2. DaneSzukajPodmioty po NIP (sid w nagłówku HTTP)
    const odpSzukaj = await wywolaj(
      endpoint,
      `${AKCJA}/DaneSzukajPodmioty`,
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip>${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
      sid,
    );
    const wewnetrzny = tag(odpSzukaj, "DaneSzukajPodmiotyResult");
    if (!wewnetrzny || /ErrorCode/i.test(wewnetrzny)) {
      return { ok: false, blad: "Nie znaleziono firmy o tym NIP w bazie REGON." };
    }
    const dane = parsujDaneSzukaj(wewnetrzny);
    if (!dane) return { ok: false, blad: "Nie znaleziono firmy o tym NIP w bazie REGON." };

    return { ok: true, dane: { ...dane, test } };
  } catch (e) {
    console.error("[regon] blad:", e);
    return { ok: false, blad: "Rejestr REGON jest chwilowo niedostępny. Spróbuj ponownie później." };
  } finally {
    // 3. Wyloguj (best-effort)
    if (sid) {
      try {
        await wywolaj(endpoint, `${AKCJA}/Wyloguj`, `<ns:Wyloguj><ns:pIdentyfikatorSesji>${esc(sid)}</ns:pIdentyfikatorSesji></ns:Wyloguj>`, sid);
      } catch {
        // wylogowanie nieudane nie wpływa na wynik
      }
    }
  }
}
