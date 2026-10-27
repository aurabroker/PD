import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Odswieza sesje Supabase przy kazdym zadaniu do panelu.
 * Bez tego token wygasa w trakcie pracy i agent wypada z panelu w środku edycji.
 *
 * Next 16 nazywa to `proxy.ts`, ale proxy działa w runtime Node, a ten na Cloudflare
 * OpenNext oznacza jako eksperymentalny i bez wsparcia. Zostajemy przy `middleware.ts`
 * (runtime edge, w pełni wspierany) do czasu, aż OpenNext oficjalnie obsłuży proxy.
 */
export async function middleware(request: NextRequest) {
  let odpowiedz = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (ciasteczka: { name: string; value: string; options: CookieOptions }[]) => {
          ciasteczka.forEach(({ name, value }) => request.cookies.set(name, value));
          odpowiedz = NextResponse.next({ request });
          ciasteczka.forEach(({ name, value, options }) =>
            odpowiedz.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return odpowiedz;
}

export const config = {
  matcher: ["/admin/:path*", "/moje", "/auth/:path*"],
};
