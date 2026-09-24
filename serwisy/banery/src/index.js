/**
 * banery — wspólne grafiki utratadochodu.pl dla wszystkich serwisów.
 *
 * Grafiki wbudowane w worker (moduły binarne): jeden plik do wdrożenia.
 *   /banery/<nazwa>.jpg | .webp          1200×628 (~50–130 KB / ~25–75 KB)
 *   /banery/<nazwa>-600.jpg | -600.webp  600×314 (telefony, maile)
 *   /banery/<nazwa>.png                  301 → .jpg (stare adresy działają dalej, a są lżejsze)
 *   /banery/index.json                   lista banerów z wariantami
 * Oryginały PNG (0,3–1 MB) leżą w oryginaly/ i nie są wdrażane.
 * Każdy serwis i klient poczty może je osadzić (CORS, CORP cross-origin).
 */
import programista_jpg from "./banery/programista.jpg";
import programista_webp from "./banery/programista.webp";
import programista_600_jpg from "./banery/programista-600.jpg";
import programista_600_webp from "./banery/programista-600.webp";
import balerina_jpg from "./banery/balerina.jpg";
import balerina_webp from "./banery/balerina.webp";
import balerina_600_jpg from "./banery/balerina-600.jpg";
import balerina_600_webp from "./banery/balerina-600.webp";
import aktor_jpg from "./banery/aktor.jpg";
import aktor_webp from "./banery/aktor.webp";
import aktor_600_jpg from "./banery/aktor-600.jpg";
import aktor_600_webp from "./banery/aktor-600.webp";
import architekt_jpg from "./banery/architekt.jpg";
import architekt_webp from "./banery/architekt.webp";
import architekt_600_jpg from "./banery/architekt-600.jpg";
import architekt_600_webp from "./banery/architekt-600.webp";
import dentysta_jpg from "./banery/dentysta.jpg";
import dentysta_webp from "./banery/dentysta.webp";
import dentysta_600_jpg from "./banery/dentysta-600.jpg";
import dentysta_600_webp from "./banery/dentysta-600.webp";
import przedsiebiorca_jpg from "./banery/przedsiebiorca.jpg";
import przedsiebiorca_webp from "./banery/przedsiebiorca.webp";
import przedsiebiorca_600_jpg from "./banery/przedsiebiorca-600.jpg";
import przedsiebiorca_600_webp from "./banery/przedsiebiorca-600.webp";
import nurkowanie_jpg from "./banery/nurkowanie.jpg";
import nurkowanie_webp from "./banery/nurkowanie.webp";
import nurkowanie_600_jpg from "./banery/nurkowanie-600.jpg";
import nurkowanie_600_webp from "./banery/nurkowanie-600.webp";
import jacht_jpg from "./banery/jacht.jpg";
import jacht_webp from "./banery/jacht.webp";
import jacht_600_jpg from "./banery/jacht-600.jpg";
import jacht_600_webp from "./banery/jacht-600.webp";
import narty_jpg from "./banery/narty.jpg";
import narty_webp from "./banery/narty.webp";
import narty_600_jpg from "./banery/narty-600.jpg";
import narty_600_webp from "./banery/narty-600.webp";
import rodzina_jpg from "./banery/rodzina.jpg";
import rodzina_webp from "./banery/rodzina.webp";
import rodzina_600_jpg from "./banery/rodzina-600.jpg";
import rodzina_600_webp from "./banery/rodzina-600.webp";
import podroze_jpg from "./banery/podroze.jpg";
import podroze_webp from "./banery/podroze.webp";
import podroze_600_jpg from "./banery/podroze-600.jpg";
import podroze_600_webp from "./banery/podroze-600.webp";
import dom_jpg from "./banery/dom.jpg";
import dom_webp from "./banery/dom.webp";
import dom_600_jpg from "./banery/dom-600.jpg";
import dom_600_webp from "./banery/dom-600.webp";
import lista from "./banery/index.json";

const PLIKI = {
  "programista.jpg": programista_jpg,
  "programista.webp": programista_webp,
  "programista-600.jpg": programista_600_jpg,
  "programista-600.webp": programista_600_webp,
  "balerina.jpg": balerina_jpg,
  "balerina.webp": balerina_webp,
  "balerina-600.jpg": balerina_600_jpg,
  "balerina-600.webp": balerina_600_webp,
  "aktor.jpg": aktor_jpg,
  "aktor.webp": aktor_webp,
  "aktor-600.jpg": aktor_600_jpg,
  "aktor-600.webp": aktor_600_webp,
  "architekt.jpg": architekt_jpg,
  "architekt.webp": architekt_webp,
  "architekt-600.jpg": architekt_600_jpg,
  "architekt-600.webp": architekt_600_webp,
  "dentysta.jpg": dentysta_jpg,
  "dentysta.webp": dentysta_webp,
  "dentysta-600.jpg": dentysta_600_jpg,
  "dentysta-600.webp": dentysta_600_webp,
  "przedsiebiorca.jpg": przedsiebiorca_jpg,
  "przedsiebiorca.webp": przedsiebiorca_webp,
  "przedsiebiorca-600.jpg": przedsiebiorca_600_jpg,
  "przedsiebiorca-600.webp": przedsiebiorca_600_webp,
  "nurkowanie.jpg": nurkowanie_jpg,
  "nurkowanie.webp": nurkowanie_webp,
  "nurkowanie-600.jpg": nurkowanie_600_jpg,
  "nurkowanie-600.webp": nurkowanie_600_webp,
  "jacht.jpg": jacht_jpg,
  "jacht.webp": jacht_webp,
  "jacht-600.jpg": jacht_600_jpg,
  "jacht-600.webp": jacht_600_webp,
  "narty.jpg": narty_jpg,
  "narty.webp": narty_webp,
  "narty-600.jpg": narty_600_jpg,
  "narty-600.webp": narty_600_webp,
  "rodzina.jpg": rodzina_jpg,
  "rodzina.webp": rodzina_webp,
  "rodzina-600.jpg": rodzina_600_jpg,
  "rodzina-600.webp": rodzina_600_webp,
  "podroze.jpg": podroze_jpg,
  "podroze.webp": podroze_webp,
  "podroze-600.jpg": podroze_600_jpg,
  "podroze-600.webp": podroze_600_webp,
  "dom.jpg": dom_jpg,
  "dom.webp": dom_webp,
  "dom-600.jpg": dom_600_jpg,
  "dom-600.webp": dom_600_webp,
};

const TYPY = { jpg: "image/jpeg", webp: "image/webp" };

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
    const url = new URL(request.url);
    const glowa = request.method === "HEAD";
    const nazwa = url.pathname.startsWith("/banery/") ? url.pathname.slice("/banery/".length) : "";

    if (nazwa === "index.json") {
      return new Response(glowa ? null : JSON.stringify(lista), {
        headers: { ...NAGLOWKI, "Content-Type": "application/json; charset=utf-8" },
      });
    }
    // Stare adresy .png → lżejszy JPG tej samej grafiki.
    const png = /^([a-z]+)\.png$/.exec(nazwa);
    if (png && PLIKI[`${png[1]}.jpg`]) {
      return new Response(null, {
        status: 301,
        headers: { ...NAGLOWKI, Location: `/banery/${png[1]}.jpg` },
      });
    }
    const plik = PLIKI[nazwa];
    if (!plik) {
      return new Response("Nie znaleziono", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response(glowa ? null : plik, {
      headers: { ...NAGLOWKI, "Content-Type": TYPY[nazwa.split(".").pop()], "Content-Length": String(plik.byteLength) },
    });
  },
};
