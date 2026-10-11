/**
 * Podpis wnioskodawcy — część wspólna dla przeglądarki i serwera.
 *
 * Podpis to kreski: każda to lista punktów [x, y, t, nacisk], gdzie x i y są
 * w zakresie 0..1 względem pola podpisu (proporcje szerokość/wysokość są
 * stałe), t to milisekundy od pierwszego dotknięcia, nacisk 0..1 (rysik).
 */
export type Punkt = [x: number, y: number, t: number, nacisk: number];
export type Podpis = { png: string; punkty: Punkt[][]; proporcje: number };

/** Proporcje pola podpisu (szerokość : wysokość) — jak linia podpisu na papierze. */
export const PROPORCJE_PODPISU = 2.5;

export const LIMITY_PODPISU = { kresek: 60, punktow: 6000, pngZnakow: 400_000 } as const;

/**
 * Czy to podpis, a nie przypadkowa kropka: dość punktów, dość długa linia
 * i zajęta sensowna część pola. Ta sama reguła w przeglądarce i na serwerze.
 */
export function wystarczajacyPodpis(punkty: Punkt[][], proporcje = PROPORCJE_PODPISU): boolean {
  const wszystkie = punkty.flat();
  if (wszystkie.length < 10) return false;
  let dlugosc = 0;
  for (const kreska of punkty) {
    for (let i = 1; i < kreska.length; i++) {
      const dx = kreska[i][0] - kreska[i - 1][0];
      const dy = (kreska[i][1] - kreska[i - 1][1]) / proporcje; // w jednostkach szerokości
      dlugosc += Math.hypot(dx, dy);
    }
  }
  const xs = wszystkie.map((p) => p[0]);
  const ys = wszystkie.map((p) => p[1]);
  const szer = Math.max(...xs) - Math.min(...xs);
  const wys = Math.max(...ys) - Math.min(...ys);
  return dlugosc >= 0.3 && (szer >= 0.12 || wys >= 0.25);
}
