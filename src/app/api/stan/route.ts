import { NextResponse } from "next/server";
import { stanKonfiguracji, supabaseAdmin } from "@/lib/supabase/admin";
import { WERSJA } from "@/lib/wersja.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostyka wdrozenia. Mowi, czego brakuje, bez ujawniania wartosci -
 * zwraca wylacznie informacje "ustawione / brak".
 *
 * Bez tego kazdy blad konfiguracji wyglada w panelu Cloudflare tak samo:
 * jako gole 500 bez tresci.
 */
export async function GET() {
  const zmienne = stanKonfiguracji();
  // Wersja na poczatku kazdej odpowiedzi: pozwala od razu stwierdzic,
  // czy wdrozony jest kod, o ktorym mowa.
  const wersja = WERSJA;
  const brakujace = Object.entries(zmienne)
    .filter(([, ustawione]) => !ustawione)
    .map(([nazwa]) => nazwa);

  if (brakujace.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        wersja,
        etap: "zmienne srodowiskowe",
        zmienne,
        brakujace,
        rada:
          "Ustaw brakujace w Cloudflare: Worker > Settings > Variables & Secrets. " +
          "SUPABASE_SERVICE_ROLE_KEY jako Secret. Zmienne NEXT_PUBLIC_* musza byc " +
          "dostepne takze podczas builda (Settings > Build), bo Next wstrzykuje je przy kompilacji.",
      },
      { status: 503 },
    );
  }

  try {
    const { error, count } = await supabaseAdmin()
      .from("mienie_wnioski")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, wersja, etap: "polaczenie z baza", zmienne, blad: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      wersja,
      zmienne,
      baza: { polaczenie: "OK", wnioskow: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, wersja, etap: "polaczenie z baza", zmienne, blad: (e as Error)?.message },
      { status: 503 },
    );
  }
}
