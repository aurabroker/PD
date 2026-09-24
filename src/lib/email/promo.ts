/**
 * Baner w mailu z potwierdzeniem złożenia wniosku.
 *
 * Obraz musi leżeć pod publicznym adresem (klienci poczty nie pokazują
 * obrazków z załączników inline tak samo) — trzymamy go w public/email/
 * i podajemy pełny adres aplikacji. `obraz: null` = baner wyłączony.
 * Wiele programów pocztowych domyślnie blokuje obrazki, dlatego alt
 * jest pełnym komunikatem, a link działa też bez obrazka.
 */
export const PROMO: { obraz: string | null; href: string; alt: string; szerokosc: number } = {
  obraz: null, // np. "/email/baner-utratadochodu.jpg"
  href: "https://utratadochodu.pl/?utm_source=email&utm_medium=display&utm_campaign=thankyou&utm_content=wnioskibeauty",
  alt: "Ubezpieczenie od utraty dochodu — utratadochodu.pl",
  szerokosc: 544,
};
