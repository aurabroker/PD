// Punkt wejścia Workera: aplikacja Next.js (zbudowana przez OpenNext do .open-next/)
// plus harmonogram — codzienne przypomnienia o niezłożonych wnioskach.
//
// `fetch` to bez zmian handler OpenNext. `scheduled` (cron z wrangler.jsonc) wywołuje
// wewnętrznie POST /api/cron/przypomnienia — bez wychodzenia do sieci — z kluczem
// liczonym tak samo jak w src/lib/cron.ts.
import aplikacja from "./.open-next/worker.js";

const ADRES_APLIKACJI = "https://wnioski.auraexpert.pl";

async function kluczCrona(sekret) {
  const skrot = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`cron-przypomnienia:${sekret}`));
  return [...new Uint8Array(skrot)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: aplikacja.fetch,

  async scheduled(kontroler, env, ctx) {
    const sekret = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sekret) {
      console.error("[cron] brak SUPABASE_SERVICE_ROLE_KEY — przypomnienia pominięte");
      return;
    }
    const zadanie = new Request(`${ADRES_APLIKACJI}/api/cron/przypomnienia`, {
      method: "POST",
      headers: { "x-cron-klucz": await kluczCrona(sekret) },
    });
    const odp = await aplikacja.fetch(zadanie, env, ctx);
    const tresc = await odp.text();
    const log = odp.ok ? console.log : console.error;
    log(`[cron] ${kontroler.cron} przypomnienia: HTTP ${odp.status} ${tresc.slice(0, 500)}`);
  },
};
