/**
 * Publiczny klucz witryny Turnstile (site key). Jest publiczny z definicji —
 * widnieje w kodzie strony — wiec trzymanie go na stale jest bezpieczne i
 * oszczedza konfiguracji zmiennej builda. Mozna nadpisac przez
 * NEXT_PUBLIC_TURNSTILE_SITEKEY (np. pusta wartosc wylacza widget w testach).
 */
export const TURNSTILE_SITEKEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "0x4AAAAAAFBFX3y_s7cboDJF";

/** Czy pokazywac widget (i wymagac tokenu) po stronie klienta. */
export const TURNSTILE_WLACZONY = Boolean(TURNSTILE_SITEKEY);
