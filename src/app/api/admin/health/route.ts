import { NextResponse } from "next/server";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { raportZdrowia } from "@/lib/zdrowie";

export const dynamic = "force-dynamic";

/** Stan dla wskaźnika w zakładce Health (tylko admin). Szczegóły — /admin/health. */
export async function GET() {
  if (!(await wymaganyAdmin())) {
    return NextResponse.json({ blad: "Brak uprawnień." }, { status: 401 });
  }
  const raport = await raportZdrowia();
  return NextResponse.json(
    {
      stan: raport.stan,
      sprawdzono: raport.sprawdzono,
      bledy: raport.sprawdzenia.filter((s) => s.stan === "blad").map((s) => s.nazwa),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
