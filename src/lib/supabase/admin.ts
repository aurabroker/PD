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

/**
 * Rola zapisana w kluczu serwisowym, odczytana z samego klucza.
 *
 * Podstawienie klucza `anon` w miejsce `service_role` jest latwe do przeoczenia
 * i daje mylacy obraz: odczyt "dziala" (RLS po cichu zwraca zero wierszy),
 * a dopiero zapis leci na polityke. Ta funkcja nazywa problem wprost.
 *
 * Czyta wylacznie jawna czesc tokenu (payload JWT jest zakodowany base64,
 * nie zaszyfrowany) - nie weryfikuje podpisu i niczego nie ujawnia.
 */
export function rolaKluczaSerwisowego(): {
  rozpoznana: string;
  poprawna: boolean;
  uwaga?: string;
} {
  const klucz = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!klucz) return { rozpoznana: "brak", poprawna: false, uwaga: "Zmienna nie jest ustawiona." };

  if (klucz !== klucz.trim()) {
    return {
      rozpoznana: "nieczytelna",
      poprawna: false,
      uwaga: "Klucz ma spacje lub znak nowej linii na brzegu — przekopiuj go bez nich.",
    };
  }

  // Nowy format kluczy Supabase.
  if (klucz.startsWith("sb_secret_")) return { rozpoznana: "secret", poprawna: true };
  if (klucz.startsWith("sb_publishable_")) {
    return {
      rozpoznana: "publishable",
      poprawna: false,
      uwaga: "To klucz publiczny. Potrzebny jest Secret key (sb_secret_...).",
    };
  }

  // Format starszy: JWT z rola w payloadzie.
  const czesci = klucz.split(".");
  if (czesci.length !== 3) {
    return { rozpoznana: "nieznany format", poprawna: false, uwaga: "To nie wygląda na klucz Supabase." };
  }

  try {
    const payload = JSON.parse(atob(czesci[1].replace(/-/g, "+").replace(/_/g, "/")));
    const rola = String(payload.role ?? "brak roli");

    if (rola === "service_role") return { rozpoznana: rola, poprawna: true };

    return {
      rozpoznana: rola,
      poprawna: false,
      uwaga:
        rola === "anon"
          ? "Podstawiono klucz anon zamiast service_role. Odczyt pozornie działa, " +
            "ale RLS zwraca zero wierszy, a każdy zapis jest odrzucany."
          : `Klucz ma rolę "${rola}", oczekiwano "service_role".`,
    };
  } catch {
    return { rozpoznana: "nieczytelna", poprawna: false, uwaga: "Nie udało się odczytać roli z klucza." };
  }
}
