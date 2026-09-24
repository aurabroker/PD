import "server-only";
import { supabaseAdmin } from "./supabase/admin";

export type Zdarzenie = "zlozenie" | "status" | "przydzial" | "email";

/**
 * Wpis do historii wniosku. Best-effort: blad zapisu historii nie moze
 * cofnac ani zablokowac operacji, ktora opisuje — zostaje slad w logach.
 */
export async function zapiszHistorie(
  wniosekId: string,
  kto: string | null,
  zdarzenie: Zdarzenie,
  szczegoly: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("mienie_historia")
      .insert({ wniosek_id: wniosekId, kto, zdarzenie, szczegoly });
    if (error) console.error("[historia] zapis:", error.message);
  } catch (e) {
    console.error("[historia] wyjatek:", e instanceof Error ? e.message : e);
  }
}

export type WpisHistorii = {
  id: number;
  kto: string | null;
  zdarzenie: Zdarzenie;
  szczegoly: Record<string, unknown>;
  created_at: string;
};

export async function historiaWniosku(wniosekId: string): Promise<WpisHistorii[]> {
  const { data, error } = await supabaseAdmin()
    .from("mienie_historia")
    .select("id, kto, zdarzenie, szczegoly, created_at")
    .eq("wniosek_id", wniosekId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[historia] odczyt:", error.message);
    return [];
  }
  return (data ?? []) as WpisHistorii[];
}
