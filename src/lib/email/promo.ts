/**
 * Baner utratadochodu.pl — strona „Dziękujemy” po złożeniu wniosku i (opcjonalnie) mail.
 *
 * Grafiki serwuje worker `banery` (serwisy/banery, banery.auraexpert.pl); przy każdym wyświetleniu losujemy jedną.
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
].map((nazwa) => ({ nazwa, url: `https://banery.auraexpert.pl/banery/${nazwa}.jpg` }));

/** Warianty każdej grafiki w workerze `banery`: JPG i WebP, 1200 i 600 px szerokości. */
export const WARIANTY = [".jpg", ".webp", "-600.jpg", "-600.webp"] as const;
const ZRODLO = "https://banery.auraexpert.pl/banery/";

export const PROMO = {
  wMailu: false,
  alt: "Ubezpieczenie od utraty dochodu — utratadochodu.pl",
  szerokosc: 544,
};

export type Baner = {
  /** JPG 1200 px — dla maila i jako zapasowy `src` na stronie. */
  obraz: string;
  /** Na stronie: lżejsze WebP i mniejsze warianty dla telefonów. */
  srcsetWebp?: string;
  srcsetJpg?: string;
  href: string;
  alt: string;
  szerokosc: number;
};

/**
 * Losowy baner z linkiem oznaczonym UTM dla danego miejsca wyświetlenia.
 * Na stronie grafika idzie z naszej domeny (/grafika/…, patrz app/grafika),
 * w mailu — bezpośrednio z banery.auraexpert.pl (klient poczty pobiera ją sam).
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
  const wspolne = { href: `https://utratadochodu.pl/?${utm}`, alt: PROMO.alt, szerokosc: PROMO.szerokosc };
  if (zrodlo === "email") return { obraz: `${ZRODLO}${b.nazwa}.jpg`, ...wspolne };
  const g = `/grafika/${b.nazwa}`;
  return {
    obraz: `${g}.jpg`,
    srcsetWebp: `${g}-600.webp 600w, ${g}.webp 1200w`,
    srcsetJpg: `${g}-600.jpg 600w, ${g}.jpg 1200w`,
    ...wspolne,
  };
}
