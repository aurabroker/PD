import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "./supabase/admin";
import { wniosekRoboczySchema, type WniosekRoboczy } from "./schema";
import { LIMITY_PODPISU, wystarczajacyPodpis, type Podpis, type Punkt } from "./podpis-wspolne";

/**
 * Podpis wnioskodawcy po stronie serwera: sprawdzenie, skróty i zapis.
 *
 * Obraz pochodzi z przeglądarki klienta, więc traktujemy go jak niezaufany:
 * tylko PNG (sprawdzamy nagłówek i wymiary), ograniczony rozmiar, punkty jako
 * liczby w zakresie. Skrót treści wiąże podpis z wnioskiem w chwili złożenia.
 */

const punkt = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(([x, y, t, p]) => [x, y, t, p].every(Number.isFinite) && x >= -0.05 && x <= 1.05 && y >= -0.05 && y <= 1.05 && t >= 0 && p >= 0 && p <= 1);

const wejscie = z.object({
  png: z.string().max(LIMITY_PODPISU.pngZnakow + 30),
  punkty: z.array(z.array(punkt).min(1)).min(1).max(LIMITY_PODPISU.kresek),
  proporcje: z.number().gt(0.5).lt(10),
});

export type PodpisSprawdzony = Podpis & { pngBase64: string; skrotPodpisu: string };

function base64NaBajty(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const wynik = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) wynik[i] = bin.charCodeAt(i);
    return wynik;
  } catch {
    return null;
  }
}

export async function sha256(dane: string | Uint8Array): Promise<string> {
  const bajty = typeof dane === "string" ? new TextEncoder().encode(dane) : dane;
  const skrot = await crypto.subtle.digest("SHA-256", new Uint8Array(bajty));
  return [...new Uint8Array(skrot)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Kanoniczna treść wniosku do skrótu: przepuszczona przez schemat roboczy
 * (stała kolejność pól, ujednolicone typy), żeby ten sam wniosek odczytany
 * później z bazy dawał ten sam skrót.
 */
export const kanonicznaTresc = (dane: WniosekRoboczy | unknown) =>
  JSON.stringify(wniosekRoboczySchema.parse(dane));

export async function zweryfikujPodpis(
  dane: unknown,
): Promise<{ ok: true; podpis: PodpisSprawdzony } | { ok: false; blad: string }> {
  const brak = { ok: false as const, blad: "Podpisz wniosek w polu podpisu" };
  const w = wejscie.safeParse(dane);
  if (!w.success) return brak;
  const { png, punkty, proporcje } = w.data;
  if (punkty.flat().length > LIMITY_PODPISU.punktow) return { ok: false, blad: "Podpis jest zbyt złożony — podpisz się jeszcze raz" };
  if (!wystarczajacyPodpis(punkty as Punkt[][], proporcje)) return { ok: false, blad: "Podpis jest za krótki — podpisz się tak jak na papierze" };

  const pngBase64 = png.replace(/^data:image\/png;base64,/, "");
  const bajty = base64NaBajty(pngBase64);
  // PNG: sygnatura 8 bajtów, potem blok IHDR z szerokością i wysokością.
  const sygnatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!bajty || bajty.length < 33 || sygnatura.some((b, i) => bajty[i] !== b)) return brak;
  const dv = new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength);
  const szer = dv.getUint32(16);
  const wys = dv.getUint32(20);
  if (szer < 50 || wys < 20 || szer > 2400 || wys > 1200) return brak;

  return {
    ok: true,
    podpis: { png, punkty: punkty as Punkt[][], proporcje, pngBase64, skrotPodpisu: await sha256(bajty) },
  };
}

export async function zapiszPodpis(o: {
  wniosekId: string;
  podpis: PodpisSprawdzony;
  skrotTresci: string;
  ip: string | null;
  userAgent: string | null;
}) {
  const { error } = await supabaseAdmin()
    .from("mienie_podpisy")
    .upsert(
      {
        wniosek_id: o.wniosekId,
        png: o.podpis.pngBase64,
        punkty: o.podpis.punkty,
        proporcje: o.podpis.proporcje,
        podpisano_at: new Date().toISOString(),
        ip: o.ip,
        user_agent: o.userAgent?.slice(0, 400) ?? null,
        skrot_tresci: o.skrotTresci,
        skrot_podpisu: o.podpis.skrotPodpisu,
      },
      { onConflict: "wniosek_id" },
    );
  if (error) throw new Error(`Nie udało się zapisać podpisu: ${error.message}`);
}

export type PodpisZBazy = {
  png: string; // base64
  punkty: Punkt[][];
  proporcje: number;
  podpisano_at: string;
  ip: string | null;
  user_agent: string | null;
  skrot_tresci: string;
  skrot_podpisu: string;
};

export async function pobierzPodpis(wniosekId: string): Promise<PodpisZBazy | null> {
  const { data, error } = await supabaseAdmin()
    .from("mienie_podpisy")
    .select("png, punkty, proporcje, podpisano_at, ip, user_agent, skrot_tresci, skrot_podpisu")
    .eq("wniosek_id", wniosekId)
    .maybeSingle();
  if (error) {
    console.error("[podpis] odczyt:", error.message);
    return null;
  }
  return (data as PodpisZBazy | null) ?? null;
}
