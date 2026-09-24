import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { WERSJA } from "@/lib/wersja.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Publiczny test „czy aplikacja żyje” — do monitoringu i sprawdzenia wdrożonej
 * wersji. Celowo bez szczegółów: nazwy brakujących zmiennych, rola klucza czy
 * liczba wniosków mówiłyby obcym za dużo. Pełna diagnostyka jest w panelu:
 * zakładka Health (/admin/health, tylko administrator).
 */
export async function GET() {
  let baza = false;
  try {
    const { error } = await supabaseAdmin().from("mienie_wnioski").select("id", { head: true, count: "exact" });
    baza = !error;
  } catch {
    baza = false;
  }
  return NextResponse.json(
    { ok: baza, wersja: WERSJA, baza: baza ? "OK" : "BLAD", szczegoly: "/admin/health" },
    { status: baza ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
