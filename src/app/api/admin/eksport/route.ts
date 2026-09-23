import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Eksport listy wnioskow do .xlsx.
 *
 * Celowo nie CSV: w CSV komorka zaczynajaca sie od = + - @ jest przez Excela
 * traktowana jak formula (CSV injection). ExcelJS zapisuje kazda wartosc jako
 * komorke tekstowa (typ „s"), wiec „=cmd|…" z pola wniosku pokaze sie doslownie
 * i nigdy nie zostanie wykonane.
 */
export async function GET() {
  if (!(await biezacyAdmin())) {
    return NextResponse.json({ blad: "Brak uprawnień." }, { status: 401 });
  }

  const { data } = await supabaseAdmin()
    .from("mienie_wnioski")
    .select(
      "nr_referencyjny, status, zrodlo, nazwa_firmy, nip, email_kontaktowy, telefon, rodzaj_dzialalnosci, suma_lacznie, created_at, wyslano_at",
    )
    .order("created_at", { ascending: false });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Wnioski majątkowe");

  ws.columns = [
    { header: "Numer", key: "nr", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Źródło", key: "zrodlo", width: 10 },
    { header: "Ubezpieczający", key: "firma", width: 34 },
    { header: "NIP", key: "nip", width: 14 },
    { header: "E-mail", key: "email", width: 26 },
    { header: "Telefon", key: "telefon", width: 18 },
    { header: "Działalność", key: "dzialalnosc", width: 30 },
    { header: "Suma ubezpieczenia", key: "suma", width: 18 },
    { header: "Utworzony", key: "utworzony", width: 14 },
    { header: "Złożony", key: "zlozony", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Wartosc jako TEKST — nigdy nie jako formula. Number() tylko dla sumy.
  const t = (v: unknown) => (v == null ? "" : String(v));

  for (const w of data ?? []) {
    ws.addRow({
      nr: t(w.nr_referencyjny),
      status: t(w.status),
      zrodlo: t(w.zrodlo),
      firma: t(w.nazwa_firmy),
      nip: t(w.nip),
      email: t(w.email_kontaktowy),
      telefon: t(w.telefon),
      dzialalnosc: t(w.rodzaj_dzialalnosci),
      suma: typeof w.suma_lacznie === "number" ? w.suma_lacznie : Number(w.suma_lacznie) || 0,
      utworzony: w.created_at?.slice(0, 10) ?? "",
      zlozony: w.wyslano_at?.slice(0, 10) ?? "",
    });
  }

  const bufor = await wb.xlsx.writeBuffer();
  const nazwa = `wnioski-majatkowe-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(bufor, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nazwa}"`,
      "Cache-Control": "no-store",
    },
  });
}
