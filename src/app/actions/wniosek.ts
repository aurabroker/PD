"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { biezacyAdmin } from "@/lib/autoryzacja";
import { zweryfikujTurnstile } from "@/lib/turnstile";
import { sprawdzPlikXlsx, BladPliku } from "@/lib/excel/bezpieczenstwo";
import { wczytajWniosekZExcela } from "@/lib/excel/parse";
import type { OstrzezenieImportu } from "@/lib/excel/parse";
import { pustyWniosek, wniosekDoZlozeniaSchema, wniosekRoboczySchema } from "@/lib/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pobierzWniosek, utworzWniosek, zapiszWniosek } from "@/lib/wnioski";
import { STATUS } from "@/lib/slowniki";

export type WynikAkcji =
  | { ok: true; komunikat?: string }
  | { ok: false; blad: string; bledyPol?: Record<string, string> };

/** Adres IP klienta z naglowkow Cloudflare — przekazywany do weryfikacji Turnstile. */
async function ipKlienta(): Promise<string | null> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

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
export async function akcjaNowyWniosek(turnstileToken?: string): Promise<WynikAkcji> {
  if (!(await zweryfikujTurnstile(turnstileToken, await ipKlienta()))) {
    return { ok: false, blad: "Potwierdź, że nie jesteś robotem, i spróbuj ponownie." };
  }

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

/**
 * Zapis roboczy. Schemat roboczy nie odrzuca danych - wniosek w trakcie
 * wypelniania ma prawo byc niekompletny i miec bledy, a klient nie moze
 * stracic tego, co wpisal. Poprawnosc sprawdza dopiero zlozenie.
 */
export async function akcjaZapiszRoboczy(token: string, dane: unknown): Promise<WynikAkcji> {
  const wynik = wniosekRoboczySchema.safeParse(dane);

  if (!wynik.success) {
    // Nie powinno sie zdarzyc - schemat roboczy lapie kazdy blad typu.
    // Jesli jednak, zostawiamy slad, zamiast gubic dane po cichu.
    console.error("[akcjaZapiszRoboczy] nieoczekiwany ksztalt danych:", wynik.error.issues.slice(0, 5));
    return { ok: false, blad: "Nie udało się zapisać — odśwież stronę i spróbuj ponownie." };
  }

  try {
    await zapiszWniosek(token, wynik.data);
    revalidatePath(`/wniosek/${token}`);
    return { ok: true, komunikat: "Zapisano wersję roboczą." };
  } catch (e) {
    console.error("[akcjaZapiszRoboczy] blad zapisu:", e);
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
    await zapiszWniosek(token, wynik.data, { zloz: true });
  } catch (e) {
    console.error("[akcjaZlozWniosek] blad zapisu:", e);
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
  if (!(await zweryfikujTurnstile(formData.get("turnstile")?.toString(), await ipKlienta()))) {
    return { ok: false, blad: "Potwierdź, że nie jesteś robotem, i spróbuj ponownie." };
  }

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

  // Wypelniony szablon ma ~130 KB; 1 MB to bezpieczny sufit. Wiekszy plik odrzucamy
  // od razu, zanim trafi do serwera akcji (limit ciala i tak wynosi ~1 MB).
  if (plik.size > 1024 * 1024) {
    return { ok: false, blad: "Plik jest większy niż 1 MB — to nie wygląda na wniosek." };
  }

  try {
    const bufor = await plik.arrayBuffer();
    // Kontrola bezpieczenstwa struktury ZIP/XML PRZED rozpakowaniem przez ExcelJS.
    await sprawdzPlikXlsx(bufor);

    const { dane, ostrzezenia } = await wczytajWniosekZExcela(bufor);
    const utworzony = await utworzWniosek(dane, {
      zrodlo: "excel",
      nazwaPliku: bezpiecznaNazwaPliku(plik.name),
    });
    return { ok: true, token: utworzony.form_token, ostrzezenia };
  } catch (e) {
    // Komunikat z kontroli bezpieczenstwa jest bezpieczny do pokazania.
    // Bledy z ExcelJS (wewnetrzne sciezki, adresy JSZip) zastepujemy ogolnym.
    if (e instanceof BladPliku) {
      return { ok: false, blad: e.message };
    }
    console.error("[akcjaImportujExcel] blad importu:", e);
    return {
      ok: false,
      blad: "Nie udało się odczytać pliku. Sprawdź, czy to wypełniony szablon wniosku (.xlsx).",
    };
  }
}

/** Nazwa pliku do zapisu w bazie: bez sciezek, bez znakow sterujacych, przycieta. */
function bezpiecznaNazwaPliku(nazwa: string): string {
  const podstawa = nazwa.split(/[\\/]/).pop() ?? "wniosek.xlsx";
  return podstawa
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "_")
    .slice(0, 120)
    .trim() || "wniosek.xlsx";
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
