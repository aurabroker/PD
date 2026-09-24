import "server-only";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Wysyłka e-maili przez Resend (REST, bez SDK — działa w Workerze).
 *
 * Konfiguracja: sekret Workera RESEND_API_KEY i zmienna RESEND_SENDER
 * (w wrangler.jsonc, np. „Wniosek ubezpieczeniowy <hub@auraexpert.pl>”).
 * Każda próba — udana i nieudana — trafia do dziennika mienie_emaile;
 * Health pokazuje nieudane wysyłki z ostatniej doby.
 */

export type Zalacznik = { nazwa: string; tresc: Uint8Array };

export type WynikWysylki = { ok: true; id: string } | { ok: false; blad: string };

function naBase64(bajty: Uint8Array): string {
  let binarnie = "";
  const KAWALEK = 0x8000; // String.fromCharCode z milionem argumentow przepelnia stos
  for (let i = 0; i < bajty.length; i += KAWALEK) {
    binarnie += String.fromCharCode(...bajty.subarray(i, i + KAWALEK));
  }
  return btoa(binarnie);
}

async function zapiszWDzienniku(wpis: {
  wniosekId: string | null;
  typ: string;
  doKogo: string;
  wynik: WynikWysylki;
}) {
  try {
    const { error } = await supabaseAdmin()
      .from("mienie_emaile")
      .insert({
        wniosek_id: wpis.wniosekId,
        typ: wpis.typ,
        do_kogo: wpis.doKogo,
        status: wpis.wynik.ok ? "wyslany" : "blad",
        blad: wpis.wynik.ok ? null : wpis.wynik.blad.slice(0, 500),
        resend_id: wpis.wynik.ok ? wpis.wynik.id : null,
      });
    if (error) console.error("[email] dziennik:", error.message);
  } catch (e) {
    console.error("[email] dziennik wyjatek:", e instanceof Error ? e.message : e);
  }
}

export async function wyslijEmail(o: {
  /** Jeden adres albo kilka (zespół) — wtedy jedna wiadomość, adresaci widzą się nawzajem. */
  do: string | string[];
  temat: string;
  html: string;
  tekst: string;
  typ: string;
  wniosekId?: string | null;
  replyTo?: string;
  zalaczniki?: Zalacznik[];
}): Promise<WynikWysylki> {
  const adresaci = Array.isArray(o.do) ? o.do : [o.do];
  const doKogo = adresaci.join(", ");
  const klucz = process.env.RESEND_API_KEY;
  const nadawca = process.env.RESEND_SENDER;

  let wynik: WynikWysylki;
  if (!klucz || !nadawca) {
    wynik = { ok: false, blad: `Brak konfiguracji: ${!klucz ? "RESEND_API_KEY " : ""}${!nadawca ? "RESEND_SENDER" : ""}`.trim() };
  } else {
    try {
      const odp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${klucz}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: nadawca,
          to: adresaci,
          subject: o.temat,
          html: o.html,
          text: o.tekst,
          ...(o.replyTo ? { reply_to: o.replyTo } : {}),
          ...(o.zalaczniki?.length
            ? { attachments: o.zalaczniki.map((z) => ({ filename: z.nazwa, content: naBase64(z.tresc) })) }
            : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const tresc = (await odp.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      wynik = odp.ok && tresc.id
        ? { ok: true, id: tresc.id }
        : { ok: false, blad: `Resend HTTP ${odp.status}: ${tresc.message ?? tresc.name ?? "brak opisu"}` };
    } catch (e) {
      wynik = { ok: false, blad: `Resend niedostępny: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  if (!wynik.ok) console.error(`[email] ${o.typ} → ${doKogo}:`, wynik.blad);
  await zapiszWDzienniku({ wniosekId: o.wniosekId ?? null, typ: o.typ, doKogo, wynik });
  return wynik;
}
