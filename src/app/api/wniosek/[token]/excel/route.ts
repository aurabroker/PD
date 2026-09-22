import { NextResponse } from "next/server";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { nazwaPliku, zbudujExcelWniosku } from "@/lib/excel/build";
import { pobierzWniosek } from "@/lib/wnioski";

// ExcelJS potrzebuje pelnego runtime Node - Edge nie wystarczy.
export const runtime = "nodejs";

/**
 * Pobranie wniosku jako .xlsx.
 * Dostep ma wlasciciel linku (zna token) albo zalogowany agent.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const wynik = await pobierzWniosek(token);
  if (!wynik) {
    return NextResponse.json({ blad: "Nie znaleziono wniosku." }, { status: 404 });
  }

  if (wynik.wygasl && !(await biezacyAdmin())) {
    return NextResponse.json({ blad: "Link do wniosku wygasł." }, { status: 410 });
  }

  const plik = await zbudujExcelWniosku(wynik.dane, {
    nrReferencyjny: wynik.meta.nr_referencyjny,
  });

  return new NextResponse(new Uint8Array(plik), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nazwaPliku(
        wynik.meta.nr_referencyjny,
        wynik.dane.nazwa_firmy,
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}
