import { BANERY, WARIANTY } from "@/lib/email/promo";

/**
 * Grafiki banera podawane z naszej domeny.
 *
 * Pliki serwuje worker `banery` (banery.auraexpert.pl), ale obrazek z innej domeny
 * i z „/banery/” w adresie to typowy cel blokerów reklam — klient widział
 * pustą ramkę. Serwujemy je więc spod /grafika/<nazwa>.<rozszerzenie>: pobieramy
 * źródło po stronie serwera (z cache Cloudflare na dobę) i oddajemy jako
 * własny zasób. Tylko nazwy z listy BANERY i ich warianty (JPG/WebP,
 * 1200/600 px) — to nie jest otwarte proxy. Stary adres .png → JPG.
 */
const ZRODLO = "https://banery.auraexpert.pl/banery/";
const DOZWOLONE = new Map<string, string>(
  BANERY.flatMap((b) => [
    ...WARIANTY.map((w) => [`${b.nazwa}${w}`, `${ZRODLO}${b.nazwa}${w}`] as [string, string]),
    [`${b.nazwa}.png`, `${ZRODLO}${b.nazwa}.jpg`] as [string, string],
  ]),
);

export async function GET(_: Request, { params }: { params: Promise<{ plik: string }> }) {
  const { plik } = await params;
  const zrodlo = DOZWOLONE.get(plik);
  if (!zrodlo) return new Response("Nie znaleziono", { status: 404 });

  try {
    const odp = await fetch(zrodlo, {
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit);
    const typ = odp.headers.get("content-type") ?? "";
    if (!odp.ok || !typ.startsWith("image/")) {
      console.error(`[grafika] ${zrodlo}: HTTP ${odp.status} ${typ}`);
      return new Response("Grafika niedostępna", { status: 502 });
    }
    return new Response(odp.body, {
      headers: {
        "Content-Type": typ,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error(`[grafika] ${zrodlo}:`, e instanceof Error ? e.message : e);
    return new Response("Grafika niedostępna", { status: 502 });
  }
}
