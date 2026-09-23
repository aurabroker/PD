import "server-only";

/**
 * Serwerowa weryfikacja tokenu Turnstile dla WLASNYCH akcji (start wniosku,
 * import pliku). Logowanie i magic link idą przez natywne wsparcie Turnstile
 * w Supabase (captchaToken) i tu nie przechodzą.
 *
 * Gdy sekret nie jest ustawiony, weryfikacja przepuszcza wszystko (fail-open) —
 * aplikacja działa normalnie do czasu skonfigurowania klucza. Po ustawieniu
 * TURNSTILE_SECRET_KEY zaczyna egzekwować.
 */
const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSkonfigurowany(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function zweryfikujTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // niezkonfigurowany → nie blokujemy
  if (!token) return false;

  try {
    const cialo = new URLSearchParams();
    cialo.set("secret", secret);
    cialo.set("response", token);
    if (ip) cialo.set("remoteip", ip);

    const odp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: cialo,
    });
    const wynik = (await odp.json()) as { success?: boolean };
    return wynik.success === true;
  } catch (e) {
    // Awaria siteverify nie moze zablokowac calego ruchu — logujemy i przepuszczamy.
    console.error("[turnstile] blad weryfikacji:", e);
    return true;
  }
}
