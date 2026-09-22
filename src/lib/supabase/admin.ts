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
    const brakujace = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !klucz && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);

    // Log trafia do Workers Logs - bez niego w panelu widac samo "500".
    console.error(
      `[konfiguracja] Brak zmiennych: ${brakujace.join(", ")}. ` +
        "Na Cloudflare ustaw je w Settings > Variables & Secrets (zakres runtime). " +
        "Diagnostyka: /api/stan",
    );

    throw new Error(`Brak konfiguracji Supabase: ${brakujace.join(", ")}`);
  }

  return createClient(url, klucz, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Czy konfiguracja Supabase jest kompletna - uzywane przez /api/stan. */
export function stanKonfiguracji() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
