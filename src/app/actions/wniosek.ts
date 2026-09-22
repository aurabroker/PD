"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { wczytajWniosekZExcela } from "@/lib/excel/parse";
import type { OstrzezenieImportu } from "@/lib/excel/parse";
import { pustyWniosek, wniosekDoZlozeniaSchema, wniosekSchema } from "@/lib/schema";
import type { Wniosek } from "@/lib/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pobierzWniosek, utworzWniosek, zapiszWniosek } from "@/lib/wnioski";
import { STATUS } from "@/lib/slowniki";

export type WynikAkcji =
  | { ok: true; komunikat?: string }
  | { ok: false; blad: string; bledyPol?: Record<string, string> };

/** Bledy walidacji zod -> mapa "sciezka pola" => komunikat, czytana przez formularz. */
function bledyPol(issues: { path: (string | number)[]; message: string }[]) {
  const mapa: Record<string, string> = {};
  for (const issue of issues) {
    const klucz = issue.path.join(".");
    if (!mapa[klucz]) mapa[klucz] = issue.message;
  }
  return mapa;
}

/**
 * Utworzenie pustego wniosku i przejscie do formularza.
 *
 * Blad zwracamy zamiast go rzucac: nieobsluzony wyjatek w Server Action
 * daje uzytkownikowi gole 500 bez zadnej wskazowki, co sie stalo.
 * `redirect()` musi zostac POZA blokiem try - dziala przez rzucenie
 * NEXT_REDIRECT, ktory catch by polknal.
 */
export async function akcjaNowyWniosek(): Promise<WynikAkcji> {
  let token: string;

  try {
    const utworzony = await utworzWniosek(pustyWniosek(), { zrodlo: "web" });
    token = utworzony.form_token;
  } catch (e) {
    console.error("[akcjaNowyWniosek] nie udalo sie utworzyc wniosku:", e);
    return {
      ok: false,
      blad:
        "Nie udało się rozpocząć wniosku. Spróbuj ponownie za chwilę, " +
        "a jeśli problem się powtarza — napisz do nas.",
    };
  }

  redirect(`/wniosek/${token}`);
}

/** Zapis roboczy. Walidacja luzna - wniosek w trakcie wypelniania ma prawo byc niekompletny. */
export async function akcjaZapiszRoboczy(token: string, dane: unknown): Promise<WynikAkcji> {
  const wynik = wniosekSchema.safeParse(dane);

  if (!wynik.success) {
    return {
      ok: false,
      blad: "Popraw zaznaczone pola, żeby zapisać wersję roboczą.",
      bledyPol: bledyPol(wynik.error.issues),
    };
  }

  try {
    await zapiszWniosek(token, wynik.data);
    revalidatePath(`/wniosek/${token}`);
    return { ok: true, komunikat: "Zapisano wersję roboczą." };
  } catch (e) {
    return { ok: false, blad: e instanceof Error ? e.message : "Nie udało się zapisać wniosku." };
  }
}

/** Zlozenie wniosku. Walidacja ostra - tu wymagane sa zgody, zakres i sumy. */
export async function akcjaZlozWniosek(token: string, dane: unknown): Promise<WynikAkcji> {
  const wynik = wniosekDoZlozeniaSchema.safeParse(dane);

  if (!wynik.success) {
    return {
      ok: false,
      blad: "Wniosku nie można złożyć — uzupełnij brakujące pola.",
      bledyPol: bledyPol(wynik.error.issues),
    };
  }

  try {
    await zapiszWniosek(token, wynik.data as Wniosek, { zloz: true });
  } catch (e) {
    return { ok: false, blad: e instanceof Error ? e.message : "Nie udało się złożyć wniosku." };
  }

  redirect(`/wniosek/${token}/zlozony`);
}

export type WynikImportuAkcji =
  | { ok: true; token: string; ostrzezenia: OstrzezenieImportu[] }
  | { ok: false; blad: string };

/**
 * Import pliku Excel. Tworzy wniosek roboczy z danych z pliku i oddaje link do formularza -
 * klient zawsze oglada i potwierdza wczytane dane, nic nie jest skladane automatycznie.
 */
export async function akcjaImportujExcel(formData: FormData): Promise<WynikImportuAkcji> {
  const plik = formData.get("plik");

  if (!(plik instanceof File) || plik.size === 0) {
    return { ok: false, blad: "Wybierz plik wniosku w formacie .xlsx." };
  }

  if (!plik.name.toLowerCase().endsWith(".xlsx")) {
    return {
      ok: false,
      blad: "Obsługujemy tylko pliki .xlsx. Jeśli masz plik .xls, zapisz go w Excelu jako .xlsx.",
    };
  }

  // 10 MB wystarcza z zapasem na wypelniony szablon; wiekszy plik to zwykle pomylka.
  if (plik.size > 10 * 1024 * 1024) {
    return { ok: false, blad: "Plik jest większy niż 10 MB — to nie wygląda na wniosek." };
  }

  try {
    const { dane, ostrzezenia } = await wczytajWniosekZExcela(await plik.arrayBuffer());
    const utworzony = await utworzWniosek(dane, { zrodlo: "excel", nazwaPliku: plik.name });
    return { ok: true, token: utworzony.form_token, ostrzezenia };
  } catch (e) {
    console.error("[akcjaImportujExcel] blad importu:", e);
    return {
      ok: false,
      blad:
        e instanceof Error
          ? e.message
          : "Nie udało się odczytać pliku. Sprawdź, czy to wypełniony szablon wniosku.",
    };
  }
}

/** Zmiana statusu wniosku w panelu. */
export async function akcjaZmienStatus(id: string, status: string): Promise<WynikAkcji> {
  if (!(await biezacyAdmin())) return { ok: false, blad: "Brak uprawnień." };

  if (!(STATUS as readonly string[]).includes(status)) {
    return { ok: false, blad: "Nieznany status." };
  }

  const { error } = await supabaseAdmin()
    .from("mienie_wnioski")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, blad: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/wnioski/${id}`);
  return { ok: true, komunikat: "Status zaktualizowany." };
}

/** Notatka agenta przy wniosku. */
export async function akcjaZapiszUwagiAgenta(id: string, uwagi: string): Promise<WynikAkcji> {
  if (!(await biezacyAdmin())) return { ok: false, blad: "Brak uprawnień." };

  const { error } = await supabaseAdmin()
    .from("mienie_wnioski")
    .update({ uwagi_agenta: uwagi.slice(0, 5000), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, blad: error.message };

  revalidatePath(`/admin/wnioski/${id}`);
  return { ok: true, komunikat: "Zapisano notatkę." };
}

/** Przedluzenie wygasajacego linku - agent robi to na prosbe klienta. */
export async function akcjaPrzedluzLink(id: string): Promise<WynikAkcji> {
  if (!(await biezacyAdmin())) return { ok: false, blad: "Brak uprawnień." };

  const nowaData = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin()
    .from("mienie_wnioski")
    .update({ token_wygasa: nowaData })
    .eq("id", id);

  if (error) return { ok: false, blad: error.message };

  revalidatePath(`/admin/wnioski/${id}`);
  return { ok: true, komunikat: "Link przedłużony o 60 dni." };
}

/** Dane wniosku dla widoku „moje wnioski" - po zalogowaniu klienta magic linkiem. */
export async function akcjaMojeWnioski(email: string) {
  const { data } = await supabaseAdmin()
    .from("mienie_wnioski")
    .select("id, nr_referencyjny, nazwa_firmy, status, created_at, updated_at, form_token, suma_lacznie")
    .ilike("email_kontaktowy", email)
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export { pobierzWniosek };
