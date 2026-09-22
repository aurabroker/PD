import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Odbior magic linku: wymiana kodu na sesje i przekierowanie tam, gdzie uzytkownik zmierzal. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kod = url.searchParams.get("code");
  const nastepnie = url.searchParams.get("nastepnie") ?? "/admin";

  // Otwarte przekierowanie bylo by tu dziura - przyjmujemy tylko sciezki wewnetrzne.
  const cel = nastepnie.startsWith("/") && !nastepnie.startsWith("//") ? nastepnie : "/admin";

  if (!kod) {
    return NextResponse.redirect(new URL("/login?blad=brak-kodu", url.origin));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(kod);

  if (error) {
    return NextResponse.redirect(new URL("/login?blad=nieprawidlowy-link", url.origin));
  }

  return NextResponse.redirect(new URL(cel, url.origin));
}
