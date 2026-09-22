import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klient zwiazany z sesja uzytkownika (ciasteczka) - do sprawdzania kto jest zalogowany. */
export async function supabaseServer() {
  const ciasteczka = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => ciasteczka.getAll(),
        setAll: (doUstawienia: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            doUstawienia.forEach(({ name, value, options }) =>
              ciasteczka.set(name, value, options),
            );
          } catch {
            // Wywolanie z Server Componentu - ciasteczka odswiezy middleware.
          }
        },
      },
    },
  );
}
