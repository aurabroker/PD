import { NextResponse } from "next/server";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { kluczCrona, rowne } from "@/lib/cron";
import { przebiegPrzypomnien } from "@/lib/przypomnienia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Przypomnienia o niezłożonych wnioskach (zasady: lib/przypomnienia.ts).
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
    console.log("[przypomnienia]", JSON.stringify(podsumowanie));
    return NextResponse.json({ ...podsumowanie, decyzje }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[przypomnienia] przebieg:", e);
    return NextResponse.json({ blad: e instanceof Error ? e.message : "Błąd przebiegu" }, { status: 500 });
  }
}
