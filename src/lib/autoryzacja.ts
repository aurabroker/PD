import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";

export type RolaAgenta = "admin" | "agent";

export type Agent = {
  user_id: string;
  email: string;
  imie_nazwisko: string;
  rola: RolaAgenta;
};

/**
 * Zalogowany uzytkownik panelu: sesja Supabase + aktywny wpis w `mienie_agenci`.
 * Kazda strona i akcja panelu musi przejsc przez te funkcje (albo `biezacyAdmin`).
 * `cache` — layout, strona i komponenty w jednym zadaniu pytaja baze raz.
 */
export const biezacyAgent = cache(async (): Promise<{ user: User; agent: Agent } | null> => {
  // Kazdy wyjatek tutaj przewraca cale /admin z nieczytelnym 500, bo funkcja
  // jest wolana w layoucie. Traktujemy blad jak brak uprawnien (przekierowanie
  // na logowanie) i zostawiamy slad w logach.
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: bladSesji,
    } = await supabase.auth.getUser();

    if (bladSesji) {
      // Brak sesji to normalna sytuacja (niezalogowany), nie blad.
      if (bladSesji.name !== "AuthSessionMissingError") {
        console.error("[biezacyAgent] blad odczytu sesji:", bladSesji.message);
      }
      return null;
    }
    if (!user) return null;

    const { data, error } = await supabaseAdmin()
      .from("mienie_agenci")
      .select("user_id, email, imie_nazwisko, rola, aktywny")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[biezacyAgent] blad odczytu mienie_agenci:", error.message);
      return null;
    }
    if (!data || !data.aktywny) return null;

    return {
      user,
      agent: {
        user_id: data.user_id,
        email: data.email,
        imie_nazwisko: data.imie_nazwisko ?? "",
        rola: data.rola === "admin" ? "admin" : "agent",
      },
    };
  } catch (e) {
    console.error("[biezacyAgent] wyjatek:", e instanceof Error ? e.message : e);
    return null;
  }
});

/**
 * Uzytkownik panelu (dowolna rola) albo null. Nazwa historyczna — sprzed rol,
 * gdy kazdy uzytkownik panelu byl adminem. Do akcji dostepnych dla kazdego agenta.
 */
export async function biezacyAdmin(): Promise<User | null> {
  return (await biezacyAgent())?.user ?? null;
}

/** Tylko rola admin: zarzadzanie agentami, Health, przydzial cudzych wnioskow. */
export async function wymaganyAdmin() {
  const a = await biezacyAgent();
  return a && a.agent.rola === "admin" ? a : null;
}

/**
 * Sprawdza, czy token daje dostep do wniosku.
 * Token jest jedynym sekretem klienta, wiec waznosc liczy sie tak samo jak jego poprawnosc.
 */
export async function wniosekZTokenu(token: string) {
  if (!token || token.length < 16) return null;

  const supabase = supabaseAdmin();
  const { data: wniosek } = await supabase
    .from("mienie_wnioski")
    .select("*")
    .eq("form_token", token)
    .maybeSingle();

  if (!wniosek) return null;

  if (wniosek.token_wygasa && new Date(wniosek.token_wygasa) < new Date()) {
    return { wniosek: null, wygasl: true as const, lokalizacje: [] };
  }

  const { data: lokalizacje } = await supabase
    .from("mienie_lokalizacje")
    .select("*")
    .eq("wniosek_id", wniosek.id)
    .order("nr");

  return { wniosek, lokalizacje: lokalizacje ?? [], wygasl: false as const };
}
