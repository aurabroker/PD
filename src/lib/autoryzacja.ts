import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";

/**
 * Zwraca uzytkownika, jesli jest zalogowany i figuruje w `katalog_admins`.
 * Kazda strona i akcja panelu musi przejsc przez te funkcje.
 */
export async function biezacyAdmin() {
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
      console.error("[biezacyAdmin] blad odczytu sesji:", bladSesji.message);
      return null;
    }
    if (!user) return null;

    const { data, error } = await supabaseAdmin()
      .from("katalog_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[biezacyAdmin] blad odczytu katalog_admins:", error.message);
      return null;
    }

    return data ? user : null;
  } catch (e) {
    console.error("[biezacyAdmin] wyjatek:", e instanceof Error ? e.message : e);
    return null;
  }
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
