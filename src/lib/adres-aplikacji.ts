import "server-only";
import { headers } from "next/headers";

/** Adres aplikacji do linków w mailach — z bieżącego żądania, nie ze zmiennej builda. */
export async function adresAplikacji(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protokol = h.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return `${protokol}://${host}`;
}

/**
 * Adres do linków w mailach musi wskazywać prawdziwy serwer. Rzuca, gdy nie wskazuje.
 *
 * 10–11.2026 przypomnienia z crona szły z linkami „https://undefined/wniosek/…”:
 * wewnętrzne żądanie harmonogramu nie miało nagłówka Host, a adres brano z żądania.
 * Lepiej nie wysłać nic (błąd w logu i w odpowiedzi crona) niż mail z martwym linkiem.
 */
export function sprawdzAdresAplikacji(adres: string): string {
  let u: URL;
  try {
    u = new URL(adres);
  } catch {
    throw new Error(`Niepoprawny adres aplikacji do linków w mailach: „${adres}”`);
  }
  const host = u.hostname;
  const lokalny = host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!/^https?:$/.test(u.protocol) || !host || host === "undefined" || host === "null" || (!lokalny && !host.includes("."))) {
    throw new Error(`Niepoprawny adres aplikacji do linków w mailach: „${adres}”`);
  }
  return u.origin;
}
