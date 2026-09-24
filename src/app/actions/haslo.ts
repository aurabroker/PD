"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const TYPY = ["invite", "recovery"] as const;

/**
 * Ustawienie hasła z jednorazowego linku (zaproszenie agenta albo reset).
 * Token jest weryfikowany dopiero tutaj — po kliknięciu, nie przy wejściu na
 * stronę — więc skaner linków w poczcie nie zużyje go przed agentem.
 */
export async function akcjaUstawHaslo(dane: {
  tokenHash: string;
  typ: string;
  haslo: string;
  powtorz: string;
}): Promise<{ blad: string } | undefined> {
  if (!TYPY.includes(dane.typ as (typeof TYPY)[number]) || !dane.tokenHash) {
    return { blad: "Link jest niepełny. Otwórz go ponownie z wiadomości e-mail." };
  }
  if (dane.haslo.length < 10) return { blad: "Hasło musi mieć co najmniej 10 znaków." };
  if (dane.haslo !== dane.powtorz) return { blad: "Hasła nie są takie same." };

  const supabase = await supabaseServer();
  const { error: bladLinku } = await supabase.auth.verifyOtp({
    token_hash: dane.tokenHash,
    type: dane.typ as (typeof TYPY)[number],
  });
  if (bladLinku) {
    return { blad: "Link wygasł albo został już użyty. Poproś administratora o nowy." };
  }

  const { error } = await supabase.auth.updateUser({ password: dane.haslo });
  if (error) {
    const komunikaty: Record<string, string> = {
      weak_password: "Hasło jest za słabe — użyj dłuższego, z cyframi i znakami specjalnymi.",
      same_password: "To hasło jest takie samo jak poprzednie — wybierz inne.",
    };
    return { blad: komunikaty[error.code ?? ""] ?? `Nie udało się ustawić hasła: ${error.message}` };
  }

  redirect("/admin");
}
