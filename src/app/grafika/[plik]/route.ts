import { BANERY } from "@/lib/email/promo";

/**
 * Grafiki banera podawane z naszej domeny.
 *
 * Pliki leżą na ergo.auraexpert.pl/banery/, ale obrazek z innej domeny
 * i z „/banery/” w adresie to typowy cel blokerów reklam — klient widział
 * pustą ramkę. Serwujemy je więc spod /grafika/<nazwa>.png: pobieramy
 * źródło po stronie serwera (z cache Cloudflare na dobę) i oddajemy jako
 * własny zasób. Tylko nazwy z listy BANERY — to nie jest otwarte proxy.
 */
const DOZWOLONE = new Map(BANERY.map((b) => [`${b.nazwa}.png`, b.url]));

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
