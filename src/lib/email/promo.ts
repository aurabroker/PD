/**
 * Baner utratadochodu.pl — strona „Dziękujemy” po złożeniu wniosku i (opcjonalnie) mail.
 *
 * Grafiki leżą na ergo.auraexpert.pl; przy każdym wyświetleniu losujemy jedną.
 * Nazwa grafiki trafia do utm_term, żeby w analityce było widać, która działa.
 * Wiele programów pocztowych domyślnie blokuje obrazki, dlatego alt jest
 * pełnym komunikatem, a link działa też bez obrazka.
 *
 * W mailu baner jest WYŁĄCZONY (`wMailu: false`): reklama innej usługi w mailu
 * transakcyjnym to informacja handlowa, która wymaga wcześniejszej zgody odbiorcy.
 */
export const BANERY = [
  "programista", "balerina", "aktor", "architekt", "dentysta", "przedsiebiorca",
  "nurkowanie", "jacht", "narty", "rodzina", "podroze", "dom",
].map((nazwa) => ({ nazwa, url: `https://ergo.auraexpert.pl/banery/${nazwa}.png` }));

export const PROMO = {
  wMailu: false,
  alt: "Ubezpieczenie od utraty dochodu — utratadochodu.pl",
  szerokosc: 544,
};

export type Baner = { obraz: string; href: string; alt: string; szerokosc: number };

/**
 * Losowy baner z linkiem oznaczonym UTM dla danego miejsca wyświetlenia.
 * Na stronie grafika idzie z naszej domeny (/grafika/…, patrz app/grafika),
 * w mailu — bezpośrednio z ergo.auraexpert.pl (klient poczty pobiera ją sam).
 */
export function losujBaner(zrodlo: "email" | "strona"): Baner {
  const b = BANERY[Math.floor(Math.random() * BANERY.length)];
  const utm = new URLSearchParams({
    utm_source: zrodlo === "email" ? "email" : "wnioski",
    utm_medium: "display",
    utm_campaign: "thankyou",
    utm_content: "wnioskibeauty",
    utm_term: b.nazwa,
  });
  const obraz = zrodlo === "strona" ? `/grafika/${b.nazwa}.png` : b.url;
  return { obraz, href: `https://utratadochodu.pl/?${utm}`, alt: PROMO.alt, szerokosc: PROMO.szerokosc };
}
