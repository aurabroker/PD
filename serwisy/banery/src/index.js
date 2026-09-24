/**
 * banery — wspólne grafiki utratadochodu.pl dla wszystkich serwisów.
 *
 * Grafiki są wbudowane w worker (moduły binarne): jeden plik do wdrożenia.
 *   /banery/<nazwa>.png   grafika 1200×628
 *   /banery/index.json    lista banerów (do losowania w innych serwisach)
 * Każdy serwis i klient poczty może je osadzić (CORS, CORP cross-origin).
 */
import programista from "./banery/programista.png";
import balerina from "./banery/balerina.png";
import aktor from "./banery/aktor.png";
import architekt from "./banery/architekt.png";
import dentysta from "./banery/dentysta.png";
import przedsiebiorca from "./banery/przedsiebiorca.png";
import nurkowanie from "./banery/nurkowanie.png";
import jacht from "./banery/jacht.png";
import narty from "./banery/narty.png";
import rodzina from "./banery/rodzina.png";
import podroze from "./banery/podroze.png";
import dom from "./banery/dom.png";
import lista from "./banery/index.json";

const PLIKI = {
  "programista.png": programista,
  "balerina.png": balerina,
  "aktor.png": aktor,
  "architekt.png": architekt,
  "dentysta.png": dentysta,
  "przedsiebiorca.png": przedsiebiorca,
  "nurkowanie.png": nurkowanie,
  "jacht.png": jacht,
  "narty.png": narty,
  "rodzina.png": rodzina,
  "podroze.png": podroze,
  "dom.png": dom,
};

const NAGLOWKI = {
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
};

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Metoda niedozwolona", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const { pathname } = new URL(request.url);
    const glowa = request.method === "HEAD";

    if (pathname === "/banery/index.json") {
      return new Response(glowa ? null : JSON.stringify(lista), {
        headers: { ...NAGLOWKI, "Content-Type": "application/json; charset=utf-8" },
      });
    }
    const plik = pathname.startsWith("/banery/") ? PLIKI[pathname.slice("/banery/".length)] : undefined;
    if (!plik) {
      return new Response("Nie znaleziono", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response(glowa ? null : plik, {
      headers: { ...NAGLOWKI, "Content-Type": "image/png", "Content-Length": String(plik.byteLength) },
    });
  },
};
