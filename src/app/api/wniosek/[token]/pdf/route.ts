import { NextResponse } from "next/server";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { generujPdfWniosku } from "@/lib/pdf/wniosek-pdf";
import { nazwaPdfWniosku } from "@/lib/powiadomienia";
import { pobierzWniosek } from "@/lib/wnioski";

/**
 * Kopia złożonego wniosku w PDF (ta sama, która idzie w mailu).
 * Dostęp ma właściciel linku (zna token) albo zalogowany agent.
 * Wersja robocza nie ma jeszcze numeru ani daty złożenia — dla niej PDF nie powstaje.
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
  if (wynik.meta.status === "roboczy") {
    return NextResponse.json({ blad: "PDF jest dostępny po złożeniu wniosku." }, { status: 409 });
  }

  const pdf = await generujPdfWniosku({
    dane: wynik.dane,
    nrReferencyjny: wynik.meta.nr_referencyjny,
    zlozono: wynik.meta.wyslano_at ? new Date(wynik.meta.wyslano_at) : null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nazwaPdfWniosku(wynik.meta.nr_referencyjny)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
