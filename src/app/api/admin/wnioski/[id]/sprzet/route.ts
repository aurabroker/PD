import { NextResponse } from "next/server";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { zbudujWykazSprzetu } from "@/lib/excel/wykaz-sprzetu";
import { numerDoPliku } from "@/lib/numeracja";
import { pobierzWniosekPoId } from "@/lib/wnioski";

// ExcelJS potrzebuje pelnego runtime Node - Edge nie wystarczy.
export const runtime = "nodejs";

/** Wykaz sprzętu wniosku (.xlsx) do załączenia w zapytaniu do ubezpieczyciela. Tylko panel. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await biezacyAdmin())) {
    return NextResponse.json({ blad: "Brak uprawnień." }, { status: 401 });
  }
  const { id } = await params;
  const wynik = /^[0-9a-f-]{36}$/i.test(id) ? await pobierzWniosekPoId(id) : null;
  if (!wynik) return NextResponse.json({ blad: "Nie znaleziono wniosku." }, { status: 404 });

  const { meta, dane } = wynik;
  const plik = await zbudujWykazSprzetu(dane, {
    nr: meta.nr_referencyjny,
    firma: dane.nazwa_firmy,
    nip: dane.nip,
    zlozono: meta.wyslano_at ? new Date(meta.wyslano_at) : null,
  });
  if (!plik) return NextResponse.json({ blad: "Wniosek nie ma wykazu sprzętu." }, { status: 404 });

  return new NextResponse(Buffer.from(plik), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Wykaz-sprzetu_${numerDoPliku(meta.nr_referencyjny)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
