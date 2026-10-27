/**
 * Sprawdzenie adresu e-mail wpisanego przez klienta — wspólne dla przeglądarki i serwera.
 *
 * Literówka w adresie to zgubiony klient: nie dostaje linku do wniosku, potwierdzenia
 * ani przypomnień (w październiku 2026 dwa z czterech przypomnień wróciły jako
 * niedoręczalne). Wykrywamy to, co da się wykryć bez wysyłki: zły format i literówki
 * w domenach popularnych skrzynek („gmial.com”, „wp.pl.pl”, „o2.p”). Literówki
 * w nazwie skrzynki przed „@” nie da się wykryć — dlatego formularz wysyła link
 * na podany adres i prosi, żeby sprawdzić, czy przyszedł.
 */

/** Popularne domeny skrzynek w Polsce i na świecie. */
const ZNANE_DOMENY = [
  "gmail.com", "googlemail.com",
  "wp.pl", "o2.pl", "onet.pl", "op.pl", "onet.eu", "poczta.onet.pl", "vp.pl", "interia.pl", "interia.eu",
  "poczta.fm", "tlen.pl", "gazeta.pl", "go2.pl", "int.pl", "spoko.pl", "buziaczek.pl", "autograf.pl",
  "icloud.com", "me.com", "outlook.com", "outlook.pl", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "proton.me", "protonmail.com",
] as const;

/** Domeny, które wyglądają jak literówka, ale istnieją — nie poprawiamy ich. */
const DOMENY_BEZ_PODPOWIEDZI = new Set(["gmx.com", "gmx.net", "wp.eu"]);

const FORMAT = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Luźniejszy kształt — „x@o2.p” nie przejdzie FORMAT, ale ma oczywistą poprawkę. */
const KSZTALT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Odległość edycyjna (Damerau–Levenshtein, z przestawieniem sąsiednich liter). */
function odleglosc(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const koszt = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + koszt);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export type WynikAdresu =
  | { stan: "pusty" }
  | { stan: "zly_format" }
  | { stan: "ok" }
  | { stan: "podejrzany"; sugestia: string };

export function sprawdzAdresEmail(wartosc: string | null | undefined): WynikAdresu {
  const adres = String(wartosc ?? "").trim().toLowerCase();
  if (!adres) return { stan: "pusty" };
  if (!KSZTALT.test(adres)) return { stan: "zly_format" };

  const [skrzynka, domena] = [adres.slice(0, adres.lastIndexOf("@")), adres.slice(adres.lastIndexOf("@") + 1)];
  const sugestia = podpowiedzDomeny(domena);
  if (!FORMAT.test(adres)) return sugestia ? { stan: "podejrzany", sugestia: `${skrzynka}@${sugestia}` } : { stan: "zly_format" };
  return sugestia ? { stan: "podejrzany", sugestia: `${skrzynka}@${sugestia}` } : { stan: "ok" };
}

/** Znana domena, o którą najpewniej chodziło — albo null (domena znana lub nic podobnego). */
function podpowiedzDomeny(domena: string): string | null {
  if ((ZNANE_DOMENY as readonly string[]).includes(domena) || DOMENY_BEZ_PODPOWIEDZI.has(domena)) return null;

  // Zdublowana końcówka: „wp.pl.pl”, „gmail.com.com”.
  for (const znana of ZNANE_DOMENY) {
    if (domena.startsWith(`${znana}.`)) return znana;
  }

  // Najbliższa znana domena: przy krótkich (wp.pl, o2.pl) dopuszczamy 1 błąd, przy dłuższych 2.
  let najlepsza: { domena: string; odl: number } | null = null;
  for (const znana of ZNANE_DOMENY) {
    const odl = odleglosc(domena, znana);
    const limit = znana.length <= 6 ? 1 : 2;
    if (odl > 0 && odl <= limit && (!najlepsza || odl < najlepsza.odl)) najlepsza = { domena: znana, odl };
  }
  return najlepsza?.domena ?? null;
}
