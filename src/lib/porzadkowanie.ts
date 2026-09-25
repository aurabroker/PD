/**
 * Porządkowanie danych wniosku przed zapisem — wspólne dla formularza
 * (autozapis i złożenie) i importu z Excela.
 *
 * Klienci wpisują w wolne pola „0”, „brak”, „-”, a w komórkę „Miejscowość
 * i data” jedno i drugie. Tu sprowadzamy to do postaci, którą da się
 * porównać i przekazać ubezpieczycielowi. Funkcje nigdy nie gubią wpisu,
 * którego nie rozumieją — zostaje bez zmian, a walidacja przy złożeniu
 * poprosi o poprawkę.
 */
import { PIETRO } from "./slowniki";
import type { WniosekRoboczy } from "./schema";

/** Wpis oznaczający „nic” (brak agencji, brak uwag itp.). */
export const jestBrak = (v: unknown) =>
  /^\s*(brak|nie|nie dotyczy|nd\.?|n\/a|bez|-+|—|–|x|0)\s*$/i.test(String(v ?? ""));

/** „Lokalizacja 2 — Salon Centrum”; nazwa równa domyślnej („Lokalizacja 2”) nie jest powtarzana. */
export function tytulLokalizacji(lok: { nr: number; nazwa: string }): string {
  const nazwa = lok.nazwa.trim();
  const domyslna = !nazwa || nazwa.toLowerCase() === `lokalizacja ${lok.nr}`;
  return `Lokalizacja ${lok.nr}${domyslna ? "" : ` — ${nazwa}`}`;
}

/** „0”, „parter”, „-1”, „2 p.” → wartość ze słownika PIETRO; nieznane bez zmian. */
export function normalizujPietro(wartosc: string): string {
  const v = wartosc.trim();
  if (!v) return "";
  const dokladna = PIETRO.find((p) => p.toLowerCase() === v.toLowerCase());
  if (dokladna) return dokladna;
  const m = v.toLowerCase().replace(/\s+/g, " ");
  if (/^(parter|p|0|0 ?p\.?|parter ?\/ ?0|przyziemie)$/.test(m)) return "Parter";
  if (/^(-\d+|suterena|piwnica|sutener[ay]?|podziemie)/.test(m)) return "Suterena / piwnica";
  if (/(cały|caly) budynek|^budynek$/.test(m)) return "Cały budynek";
  const rzymskie: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
  const liczba = /^(\d+|i{1,3}|iv|v)\s*(\.|p\.?|piętro|pietro|kondygnacja)?\s*(piętro|pietro)?$/.exec(m);
  if (liczba) {
    const n = /^\d+$/.test(liczba[1]) ? Number(liczba[1]) : rzymskie[liczba[1]];
    if (n === 0) return "Parter";
    if (n >= 1 && n <= 3) return `${n}. piętro`;
    if (n >= 4) return "4. piętro lub wyżej";
  }
  return v;
}

/** Daty spotykane w komórce „Miejscowość i data” (22.09.2026, 22-09-2026, 2026-09-22). */
const WZOR_DATY = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/;

/**
 * „Białystok 24-09-2026” / „Warszawa, 22.09.2026” → { miejscowość, data ISO }.
 * Nierozpoznana albo niemożliwa data (np. literówka „24-09-226”) jest
 * pomijana — datę złożenia i tak uzupełnia system.
 */
export function rozdzielMiejscowoscIDate(tekst: string): { miejscowosc: string; data: string } {
  const m = WZOR_DATY.exec(tekst);
  // Resztki po dacie: przecinki, „dnia”, „r.” — zostaje sama miejscowość.
  const bezDaty = (m ? tekst.replace(m[0], " ") : tekst)
    .replace(/\b(dnia|dn\.|r\.)/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[,;/\-–—.]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.\-–—]+|[\s,;.\-–—]+$/g, "")
    .trim();
  let data = "";
  if (m) {
    const [r, mies, d] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
    const rok = Number(r.length === 2 ? `20${r}` : r);
    const dt = new Date(Date.UTC(rok, Number(mies) - 1, Number(d)));
    const poprawna =
      r.length !== 3 && rok >= 2000 && rok <= 2100 &&
      dt.getUTCMonth() === Number(mies) - 1 && dt.getUTCDate() === Number(d);
    if (poprawna) data = dt.toISOString().slice(0, 10);
  }
  return { miejscowosc: bezDaty, data };
}

type Pozycja = { lokalizacja: number; nazwa: string; producent: string; model: string; nr_seryjny: string; wartosc: number; uwagi: string };

/** Wiersz dodany przyciskiem i niczym niewypełniony — nie jest urządzeniem. */
export const pustaPozycja = (u: Pozycja) =>
  !u.nazwa.trim() && !u.producent.trim() && !u.model.trim() && !u.nr_seryjny.trim() && !u.uwagi.trim() && !(Number(u.wartosc) > 0);

/** Suma wartości z wykazu dla lokalizacji. */
export const sumaWykazu = (lista: { lokalizacja: number; wartosc: number }[], nr: number) =>
  lista.filter((u) => Number(u.lokalizacja) === nr).reduce((a, u) => a + (Number(u.wartosc) || 0), 0);

/**
 * Porządki na danych wniosku:
 *  - piętro sprowadzone do słownika, „brak” w agencji ochrony → puste,
 *  - puste wiersze wykazów sprzętu usunięte,
 *  - suma sprzętu medycznego i elektroniki w lokalizacji = suma wykazu, jeśli
 *    wykaz dla tej lokalizacji ma wartości (klient wypełnia sumy przed wykazem
 *    i zostawiał 0 — wniosek szedł z zaniżoną sumą ubezpieczenia).
 */
export function uporzadkujDane<T extends WniosekRoboczy>(dane: T): T {
  const sprzet_medyczny = dane.sprzet_medyczny.filter((u) => !pustaPozycja(u));
  const elektronika_eei = dane.elektronika_eei.filter((u) => !pustaPozycja(u));
  const lokalizacje = dane.lokalizacje.map((lok) => {
    const med = sumaWykazu(sprzet_medyczny, lok.nr);
    const eei = sumaWykazu(elektronika_eei, lok.nr);
    return {
      ...lok,
      pietro: normalizujPietro(lok.pietro ?? ""),
      agencja_ochrony: jestBrak(lok.agencja_ochrony) ? "" : lok.agencja_ochrony,
      suma_sprzet_medyczny: med > 0 ? med : lok.suma_sprzet_medyczny,
      suma_elektronika_it: eei > 0 ? eei : lok.suma_elektronika_it,
    };
  });
  return { ...dane, lokalizacje, sprzet_medyczny, elektronika_eei };
}
