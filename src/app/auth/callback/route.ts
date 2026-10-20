import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Pelny adres powrotu, o ile prowadzi do tej samej domeny; inaczej null.
 * Zwracamy adres bezwzgledny, nie sama sciezke: sciezka typu "//evil.com"
 * (np. z "/..//evil.com") w naglowku Location oznaczalaby obca domene.
 */
function adresWewnetrzny(cel: string, origin: string): string | null {
  if (!cel.startsWith("/")) return null;
  try {
    const u = new URL(cel, origin);
    return u.origin === origin ? u.href : null;
  } catch {
    return null;
  }
}

/** Odbior magic linku: wymiana kodu na sesje i przekierowanie tam, gdzie uzytkownik zmierzal. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kod = url.searchParams.get("code");
  const nastepnie = url.searchParams.get("nastepnie") ?? "/admin";

  // Otwarte przekierowanie bylo by tu dziura - przyjmujemy tylko sciezki wewnetrzne.
  // Sprawdzamy wynik parsowania, nie sam napis: "/\evil.com" albo "/<TAB>/evil.com"
  // zaczynaja sie od "/", a parser URL robi z nich https://evil.com/.
  const cel = adresWewnetrzny(nastepnie, url.origin) ?? new URL("/admin", url.origin).href;

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
