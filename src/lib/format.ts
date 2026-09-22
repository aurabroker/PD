/**
 * Formatowanie wartosci do wyswietlenia.
 *
 * Modul celowo BEZ dyrektywy "use client": wolaja go zarowno Server Componenty
 * (lista i szczegoly wniosku w panelu), jak i komponenty klienckie (kreator).
 * Funkcja wyeksportowana z modulu "use client" staje sie referencja kliencka
 * i jej wywolanie po stronie serwera konczy sie bledem renderowania.
 */

/** Kwota w zlotych, bez groszy - tak jak w arkuszu i w bazie. */
export const zl = (v: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(v || 0);
