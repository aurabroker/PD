import { NextResponse } from "next/server";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Eksport listy wnioskow do CSV - do wklejenia w arkusz lub do zestawienia dla TU. */
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

  const naglowki = [
    "Numer", "Status", "Źródło", "Ubezpieczający", "NIP", "E-mail",
    "Telefon", "Działalność", "Suma ubezpieczenia", "Utworzony", "Złożony",
  ];

  // Srednik jako separator - polski Excel tak otwiera CSV bez kreatora importu.
  const naCsv = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const wiersze = (data ?? []).map((w) =>
    [
      w.nr_referencyjny, w.status, w.zrodlo, w.nazwa_firmy, w.nip, w.email_kontaktowy,
      w.telefon, w.rodzaj_dzialalnosci, w.suma_lacznie,
      w.created_at?.slice(0, 10), w.wyslano_at?.slice(0, 10) ?? "",
    ].map(naCsv).join(";"),
  );

  // BOM, zeby Excel rozpoznal UTF-8 i nie zepsul polskich znakow.
  const csv = "﻿" + [naglowki.join(";"), ...wiersze].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wnioski-majatkowe-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
