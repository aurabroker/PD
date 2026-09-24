import "server-only";
import { headers } from "next/headers";

/** Adres aplikacji do linków w mailach — z bieżącego żądania, nie ze zmiennej builda. */
export async function adresAplikacji(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protokol = h.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return `${protokol}://${host}`;
}
