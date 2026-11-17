import { NextResponse } from "next/server";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { kluczCrona, rowne } from "@/lib/cron";
import { przebiegPrzypomnien } from "@/lib/przypomnienia";
import { zestawienieSzkicow, type WynikZestawienia } from "@/lib/szkice-zespol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Przypomnienia o niezłożonych wnioskach (zasady: lib/przypomnienia.ts), a po nich
 * zestawienie niedokończonych wniosków dla zespołu (lib/szkice-zespol.ts).
 *
 * Wywołuje go codziennie harmonogram Workera (cloudflare-worker.mjs) z nagłówkiem
 * x-cron-klucz. Administrator panelu może go wywołać ręcznie; `?proba=1` zwraca
 * tylko listę decyzji, bez wysyłki.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const proba = url.searchParams.get("proba") === "1";

  const klucz = await kluczCrona();
  const podany = request.headers.get("x-cron-klucz") ?? "";
  const zHarmonogramu = Boolean(klucz && podany && rowne(podany, klucz));
  if (!zHarmonogramu && !(await wymaganyAdmin())) {
    return NextResponse.json({ blad: "Brak uprawnień." }, { status: 401 });
  }

  try {
    const decyzje = await przebiegPrzypomnien(url.origin, { proba });
    const podsumowanie = {
      proba,
      wyslane: decyzje.filter((d) => d.decyzja === "wyslane").length,
      do_wyslania: decyzje.filter((d) => d.decyzja === "do_wyslania").length,
      pominiete: decyzje.filter((d) => d.decyzja === "pominiete").length,
      bledy: decyzje.filter((d) => d.decyzja === "blad").length,
    };
    // Osobny try: błąd zestawienia nie może zgubić wyniku przypomnień (już wysłanych).
    let zestawienie: WynikZestawienia | { blad: string };
    try {
      zestawienie = await zestawienieSzkicow(url.origin, { proba });
    } catch (e) {
      console.error("[przypomnienia] zestawienie:", e);
      zestawienie = { blad: e instanceof Error ? e.message : "Błąd zestawienia" };
    }
    console.log("[przypomnienia]", JSON.stringify({ ...podsumowanie, zestawienie }));
    return NextResponse.json({ ...podsumowanie, decyzje, zestawienie }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[przypomnienia] przebieg:", e);
    return NextResponse.json({ blad: e instanceof Error ? e.message : "Błąd przebiegu" }, { status: 500 });
  }
}
