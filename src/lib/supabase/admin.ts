import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Klient z kluczem serwisowym. Omija RLS, wiec wolno go uzywac wylacznie
 * w Server Actions i Route Handlerach, nigdy w komponencie klienckim.
 * Kazde uzycie musi samo sprawdzic uprawnienie (token wniosku albo sesja admina).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const klucz = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !klucz) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych",
    );
  }

  return createClient(url, klucz, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
