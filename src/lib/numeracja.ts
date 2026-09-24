/**
 * Numer wniosku nadawany w chwili ZŁOŻENIA (nie utworzenia):
 *
 *   PD/24092026/K7M2QX      — mienie (bez elektroniki)
 *   PD/EEI/24092026/K7M2QX  — mienie + sprzęt elektroniczny (EEI)
 *   EEI/24092026/K7M2QX     — tylko sprzęt elektroniczny
 *
 * Prefiks zależy od zakresu, a zakres klient może zmieniać aż do złożenia —
 * dlatego numer powstaje przy złożeniu i potem już się nie zmienia.
 * Data = dzień złożenia w czasie polskim. Końcówka: 6 znaków z alfabetu bez
 * par mylonych przy dyktowaniu i przepisywaniu (0/O, 1/I/L).
 * Wnioski robocze mają numer techniczny z bazy (MIE-…), klient go nie widzi.
 */

export const ZAKRES_EEI = "Sprzęt elektroniczny (EEI)";

const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const WZOR_NUMERU = /^(PD|PD\/EEI|EEI)\/\d{8}\/[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function prefiksNumeru(zakres: readonly string[]): "PD" | "PD/EEI" | "EEI" {
  const eei = zakres.includes(ZAKRES_EEI);
  const mienie = zakres.some((z) => z !== ZAKRES_EEI);
  if (eei && !mienie) return "EEI";
  return eei ? "PD/EEI" : "PD";
}

/** DDMMRRRR w strefie Europe/Warsaw. */
function dataNumeru(d: Date): string {
  const czesci = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const cz = (t: string) => czesci.find((p) => p.type === t)?.value ?? "";
  return `${cz("day")}${cz("month")}${cz("year")}`;
}

function koncowka(dlugosc = 6): string {
  // Odrzucanie wartości z „ogona” bajtu, żeby każdy znak był równie prawdopodobny.
  const limit = 256 - (256 % ALFABET.length);
  let wynik = "";
  while (wynik.length < dlugosc) {
    const bajty = crypto.getRandomValues(new Uint8Array(dlugosc * 2));
    for (const b of bajty) {
      if (b < limit && wynik.length < dlugosc) wynik += ALFABET[b % ALFABET.length];
    }
  }
  return wynik;
}

export function nadajNumer(zakres: readonly string[], kiedy = new Date()): string {
  return `${prefiksNumeru(zakres)}/${dataNumeru(kiedy)}/${koncowka()}`;
}

/** Numer w nazwie pliku — ukośnik psuje nazwy plików i nagłówki pobierania. */
export const numerDoPliku = (nr: string) => nr.replace(/\//g, "-");
