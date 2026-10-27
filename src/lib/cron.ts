import "server-only";

/**
 * Klucz, którym harmonogram Workera (cloudflare-worker.mjs) wywołuje /api/cron/*.
 *
 * Wyprowadzony z klucza serwisowego Supabase — bez osobnego sekretu do ustawiania
 * w panelu; zmiana klucza serwisowego zmienia też ten. Ten sam wzór liczy
 * cloudflare-worker.mjs — obie strony muszą się zgadzać co do znaku.
 * Bez klucza serwisowego zwraca null: endpoint wtedy odmawia (klucz z pustego
 * sekretu byłby przewidywalny).
 */
export async function kluczCrona(): Promise<string | null> {
  const sekret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sekret) return null;
  const skrot = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`cron-przypomnienia:${sekret}`));
  return [...new Uint8Array(skrot)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Porównanie w stałym czasie (nie zdradza, ile znaków się zgadza). */
export function rowne(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let roznica = 0;
  for (let i = 0; i < a.length; i++) roznica |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return roznica === 0;
}
