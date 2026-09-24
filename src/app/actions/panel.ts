"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { biezacyAgent, type Agent } from "@/lib/autoryzacja";
import { zapiszHistorie } from "@/lib/historia";
import { POWODY_REZYGNACJI, STATUS, STATUS_ETYKIETY, type Status } from "@/lib/slowniki";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WynikPanelu = { ok: true; komunikat: string } | { ok: false; blad: string };

/**
 * Jedna reguła uprawnień dla operacji na wniosku:
 *  - admin — każdy wniosek,
 *  - agent — nieprzypisany albo przypisany do siebie; nieprzypisany przy
 *    pierwszej operacji przejmuje (żeby dwóch agentów nie pracowało nad jednym).
 */
async function dostepDoWniosku(id: string): Promise<
  | { ok: true; agent: Agent; wniosek: { id: string; status: Status; przypisany_agent: string | null } }
  | { ok: false; blad: string }
> {
  const sesja = await biezacyAgent();
  if (!sesja) return { ok: false, blad: "Brak uprawnień — zaloguj się ponownie." };

  const { data: wniosek, error } = await supabaseAdmin()
    .from("mienie_wnioski")
    .select("id, status, przypisany_agent")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, blad: `Błąd odczytu wniosku: ${error.message}` };
  if (!wniosek) return { ok: false, blad: "Nie znaleziono wniosku." };

  const { agent } = sesja;
  if (agent.rola !== "admin" && wniosek.przypisany_agent && wniosek.przypisany_agent !== agent.user_id) {
    return { ok: false, blad: "Ten wniosek prowadzi inny agent. Poproś administratora o przepisanie." };
  }
  return { ok: true, agent, wniosek: wniosek as { id: string; status: Status; przypisany_agent: string | null } };
}

function odswiez(id: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/wnioski/${id}`);
  revalidatePath("/admin/statystyki");
  revalidatePath("/admin/agenci");
}

const kwota = z.coerce.number({ invalid_type_error: "Podaj kwotę" }).positive("Kwota musi być większa od zera").max(100_000_000);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę");
const tekst = (min: number, komunikat: string) => z.string().trim().min(min, komunikat).max(200);

/** Dane wymagane przy przejściu do danego statusu — bez nich liczby w panelu tracą sens. */
const zmianaStatusu = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("wyceniony"),
    oferta_towarzystwo: tekst(2, "Podaj towarzystwo"),
    oferta_skladka: kwota,
  }),
  z.object({
    status: z.literal("polisa"),
    polisa_numer: tekst(3, "Podaj numer polisy"),
    polisa_skladka: kwota,
    polisa_od: data,
    polisa_do: data,
  }),
  z.object({
    status: z.literal("rezygnacja"),
    rezygnacja_powod: z.enum(POWODY_REZYGNACJI, { errorMap: () => ({ message: "Wybierz powód rezygnacji" }) }),
  }),
  ...STATUS.filter((s) => !["wyceniony", "polisa", "rezygnacja"].includes(s)).map((s) =>
    z.object({ status: z.literal(s) }),
  ),
] as unknown as [z.ZodDiscriminatedUnionOption<"status">, ...z.ZodDiscriminatedUnionOption<"status">[]]);

export async function akcjaZmienStatus(id: string, dane: unknown): Promise<WynikPanelu> {
  const dostep = await dostepDoWniosku(id);
  if (!dostep.ok) return dostep;

  const wynik = zmianaStatusu.safeParse(dane);
  if (!wynik.success) {
    return { ok: false, blad: wynik.error.issues.map((i) => i.message).join(" · ") };
  }
  const zmiana = wynik.data as { status: Status } & Record<string, unknown>;

  if (zmiana.status === "polisa" && String(zmiana.polisa_do) <= String(zmiana.polisa_od)) {
    return { ok: false, blad: "Koniec ochrony musi być po jej początku." };
  }

  const teraz = new Date().toISOString();
  const aktualizacja: Record<string, unknown> = { ...zmiana, updated_at: teraz };
  if (zmiana.status !== dostep.wniosek.status) aktualizacja.status_zmieniony_at = teraz;
  // Agent obsługujący nieprzypisany wniosek przejmuje go.
  if (!dostep.wniosek.przypisany_agent && dostep.agent.rola !== "admin") {
    aktualizacja.przypisany_agent = dostep.agent.user_id;
  }

  const { error } = await supabaseAdmin().from("mienie_wnioski").update(aktualizacja).eq("id", id);
  if (error) return { ok: false, blad: `Nie udało się zmienić statusu: ${error.message}` };

  const { status, ...pola } = zmiana;
  await zapiszHistorie(id, dostep.agent.user_id, "status", { z: dostep.wniosek.status, na: status, ...pola });
  if (aktualizacja.przypisany_agent) {
    await zapiszHistorie(id, dostep.agent.user_id, "przydzial", { na: dostep.agent.user_id, przejecie: true });
  }

  odswiez(id);
  return { ok: true, komunikat: `Status: ${STATUS_ETYKIETY[status]}.` };
}

/**
 * Przydział wniosku. Admin — dowolnemu aktywnemu agentowi albo do puli.
 * Agent — tylko sobie (nieprzypisany wniosek) albo zwrot własnego do puli.
 */
export async function akcjaPrzypiszAgenta(id: string, agentId: string | null): Promise<WynikPanelu> {
  const sesja = await biezacyAgent();
  if (!sesja) return { ok: false, blad: "Brak uprawnień — zaloguj się ponownie." };
  const { agent } = sesja;

  const baza = supabaseAdmin();
  const { data: wniosek } = await baza
    .from("mienie_wnioski")
    .select("id, przypisany_agent")
    .eq("id", id)
    .maybeSingle();
  if (!wniosek) return { ok: false, blad: "Nie znaleziono wniosku." };

  if (agent.rola !== "admin") {
    const biore = agentId === agent.user_id && !wniosek.przypisany_agent;
    const oddaje = agentId === null && wniosek.przypisany_agent === agent.user_id;
    if (!biore && !oddaje) {
      return { ok: false, blad: "Agent może przejąć wolny wniosek albo oddać własny — przydział innym robi administrator." };
    }
  }

  if (agentId) {
    const { data: cel } = await baza
      .from("mienie_agenci")
      .select("user_id, aktywny")
      .eq("user_id", agentId)
      .maybeSingle();
    if (!cel?.aktywny) return { ok: false, blad: "Wybrany agent nie istnieje albo jest nieaktywny." };
  }

  if (wniosek.przypisany_agent === agentId) return { ok: true, komunikat: "Bez zmian." };

  const { error } = await baza
    .from("mienie_wnioski")
    .update({ przypisany_agent: agentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, blad: `Nie udało się przypisać: ${error.message}` };

  await zapiszHistorie(id, agent.user_id, "przydzial", { z: wniosek.przypisany_agent, na: agentId });
  odswiez(id);
  return { ok: true, komunikat: agentId ? "Wniosek przypisany." : "Wniosek wrócił do puli." };
}

/** Notatka agenta przy wniosku. */
export async function akcjaZapiszUwagiAgenta(id: string, uwagi: string): Promise<WynikPanelu> {
  const dostep = await dostepDoWniosku(id);
  if (!dostep.ok) return dostep;

  const { error } = await supabaseAdmin()
    .from("mienie_wnioski")
    .update({ uwagi_agenta: String(uwagi ?? "").slice(0, 5000), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, blad: error.message };

  revalidatePath(`/admin/wnioski/${id}`);
  return { ok: true, komunikat: "Zapisano notatkę." };
}

/** Przedłużenie wygasającego linku klienta o 60 dni — na prośbę klienta. */
export async function akcjaPrzedluzLink(id: string): Promise<WynikPanelu> {
  const dostep = await dostepDoWniosku(id);
  if (!dostep.ok) return dostep;

  const nowaData = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin().from("mienie_wnioski").update({ token_wygasa: nowaData }).eq("id", id);
  if (error) return { ok: false, blad: error.message };

  revalidatePath(`/admin/wnioski/${id}`);
  return { ok: true, komunikat: "Link przedłużony o 60 dni." };
}
