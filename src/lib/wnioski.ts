import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { doWierszaWniosku, doWierszyLokalizacji, zWierszy } from "./mapowanie";
import { znormalizujNumeracje } from "./schema";
import { uporzadkujDane } from "./porzadkowanie";
import { kanonicznaTresc, sha256, zapiszPodpis, type PodpisSprawdzony } from "./podpis";
import type { WniosekRoboczy } from "./schema";
import type { Zgodnosc } from "./excel/zgodnosc";
import { zapiszHistorie } from "./historia";
import { nadajNumer } from "./numeracja";

/**
 * Token dostepu do wniosku. Zachowuje format uzywany przez wczesniejsze wnioski
 * (`<uuid>-ID<id firmy>`), zeby linki z CRM-u i z tej aplikacji wygladaly tak samo.
 */
export function nowyToken(companyId: number | null): string {
  // Web Crypto zamiast `node:crypto` - dostepne i w Node, i w Cloudflare Workers.
  const uuid = () => crypto.randomUUID();
  return companyId ? `${uuid()}-ID${companyId}` : `${uuid()}-W${uuid().slice(0, 8)}`;
}

/** Ile dni link do wniosku pozostaje aktywny. */
const WAZNOSC_DNI = 60;

export async function utworzWniosek(
  daneWejsciowe: WniosekRoboczy,
  opcje: {
    zrodlo: "web" | "excel" | "agent";
    companyId?: number | null;
    nazwaPliku?: string;
    zgodnosc?: Zgodnosc | null;
  },
) {
  const dane = uporzadkujDane(znormalizujNumeracje(daneWejsciowe));
  const supabase = supabaseAdmin();
  const token = nowyToken(opcje.companyId ?? null);
  const wygasa = new Date(Date.now() + WAZNOSC_DNI * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("mienie_wnioski")
    .insert({
      ...doWierszaWniosku(dane),
      form_token: token,
      company_id: opcje.companyId ?? null,
      status: "roboczy",
      zrodlo: opcje.zrodlo,
      import_plik: opcje.nazwaPliku ?? null,
      import_zgodnosc: opcje.zgodnosc ?? null,
      token_wygasa: wygasa,
    })
    .select("id, form_token, nr_referencyjny")
    .single();

  if (error) throw new Error(`Nie udało się utworzyć wniosku: ${error.message}`);

  await zapiszLokalizacje(dane, data.id, opcje.companyId ?? null, token);
  return data;
}

/**
 * Zapis lokalizacji wniosku.
 *
 * Upsert po unikalnym (wniosek_id, nr), a potem usuniecie lokalizacji o numerach
 * wiekszych niz aktualna liczba. Wczesniejsze "skasuj wszystko i wstaw od nowa"
 * przy dwoch rownoleglych zapisach (autozapis + przycisk, dwie karty) moglo
 * zostawic podwojone lokalizacje - a wniosek z 4+ lokalizacjami nie mieści sie
 * w formularzu. Unikalny indeks w bazie wyklucza to niezaleznie od kodu.
 */
async function zapiszLokalizacje(
  dane: WniosekRoboczy,
  wniosekId: string,
  companyId: number | null,
  token: string,
) {
  const supabase = supabaseAdmin();
  const wiersze = doWierszyLokalizacji(dane, wniosekId, companyId, token);

  if (wiersze.length > 0) {
    const { error } = await supabase
      .from("mienie_lokalizacje")
      .upsert(wiersze, { onConflict: "wniosek_id,nr" });
    if (error) throw new Error(`Nie udało się zapisać lokalizacji: ${error.message}`);
  }

  const { error: bladUsuwania } = await supabase
    .from("mienie_lokalizacje")
    .delete()
    .eq("wniosek_id", wniosekId)
    .gt("nr", wiersze.length);
  if (bladUsuwania) {
    throw new Error(`Nie udało się usunąć nadmiarowych lokalizacji: ${bladUsuwania.message}`);
  }
}

export async function zapiszWniosek(
  token: string,
  daneWejsciowe: WniosekRoboczy,
  opcje: {
    zloz?: boolean;
    /** Podpis wnioskodawcy — wymagany przy złożeniu z formularza (akcjaZlozWniosek). */
    podpis?: { podpis: PodpisSprawdzony; ip: string | null; userAgent: string | null };
  } = {},
) {
  const dane = uporzadkujDane(znormalizujNumeracje(daneWejsciowe));
  const supabase = supabaseAdmin();

  const { data: istniejacy, error: bladOdczytu } = await supabase
    .from("mienie_wnioski")
    .select("id, company_id, status, token_wygasa")
    .eq("form_token", token)
    .maybeSingle();

  if (bladOdczytu) throw new Error(`Błąd odczytu wniosku: ${bladOdczytu.message}`);
  if (!istniejacy) throw new Error("Nie znaleziono wniosku dla tego linku.");

  if (istniejacy.token_wygasa && new Date(istniejacy.token_wygasa) < new Date()) {
    throw new Error("Link do tego wniosku wygasł. Skontaktuj się ze swoim agentem.");
  }

  // Wniosek juz zlozony jest zamkniety na edycje przez klienta.
  if (istniejacy.status !== "roboczy") {
    throw new Error("Ten wniosek został już złożony i nie można go edytować.");
  }

  // Podpis zapisujemy PRZED zmianą statusu: złożony wniosek zawsze ma podpis.
  // Skrót liczony z treści, która za chwilę trafi do bazy.
  if (opcje.zloz && opcje.podpis) {
    await zapiszPodpis({
      wniosekId: istniejacy.id,
      podpis: opcje.podpis.podpis,
      skrotTresci: await sha256(kanonicznaTresc(dane)),
      ip: opcje.podpis.ip,
      userAgent: opcje.podpis.userAgent,
    });
  }

  const aktualizacja: Record<string, unknown> = doWierszaWniosku(dane);
  const teraz = new Date().toISOString();
  if (opcje.zloz) {
    aktualizacja.status = "zlozony";
    aktualizacja.wyslano_at = teraz;
    aktualizacja.status_zmieniony_at = teraz;
  }

  // Numer z prefiksem zakresu nadajemy dopiero przy złożeniu (patrz numeracja.ts).
  // Kolizja końcówki (unikalny indeks) jest skrajnie mało prawdopodobna — losujemy ponownie.
  // Warunek na status w samym UPDATE: autozapis z drugiej karty, który odczytał
  // status tuż przed złożeniem, nie nadpisze treści już złożonego (podpisanego) wniosku.
  let error: { message: string; code?: string } | null = null;
  let zapisane: { id: string }[] | null = null;
  for (let proba = 0; proba < 5; proba++) {
    if (opcje.zloz) aktualizacja.nr_referencyjny = nadajNumer(dane.zakres, new Date(teraz));
    ({ data: zapisane, error } = await supabase
      .from("mienie_wnioski")
      .update(aktualizacja)
      .eq("id", istniejacy.id)
      .eq("status", "roboczy")
      .select("id"));
    const kolizjaNumeru = error?.code === "23505" && /nr_referencyjny/.test(error.message);
    if (!opcje.zloz || !kolizjaNumeru) break;
  }

  if (error) throw new Error(`Nie udało się zapisać wniosku: ${error.message}`);
  if (!zapisane?.length) throw new Error("Ten wniosek został już złożony i nie można go edytować.");

  await zapiszLokalizacje(dane, istniejacy.id, istniejacy.company_id, token);
  if (opcje.zloz) {
    await zapiszHistorie(istniejacy.id, null, "zlozenie", { status: "zlozony", podpis: Boolean(opcje.podpis) });
  }
  return { id: istniejacy.id };
}

/** Wniosek gotowy do wyswietlenia w formularzu lub w panelu. */
export async function pobierzWniosek(token: string) {
  const supabase = supabaseAdmin();

  const { data: wniosek } = await supabase
    .from("mienie_wnioski")
    .select("*")
    .eq("form_token", token)
    .maybeSingle();

  if (!wniosek) return null;

  const { data: lokalizacje } = await supabase
    .from("mienie_lokalizacje")
    .select("*")
    .eq("wniosek_id", wniosek.id)
    .order("nr");

  return {
    meta: wniosek,
    dane: zWierszy(wniosek, lokalizacje ?? []),
    wygasl: Boolean(wniosek.token_wygasa && new Date(wniosek.token_wygasa) < new Date()),
  };
}

export async function pobierzWniosekPoId(id: string) {
  const supabase = supabaseAdmin();

  const { data: wniosek } = await supabase
    .from("mienie_wnioski")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!wniosek) return null;

  const { data: lokalizacje } = await supabase
    .from("mienie_lokalizacje")
    .select("*")
    .eq("wniosek_id", wniosek.id)
    .order("nr");

  return { meta: wniosek, dane: zWierszy(wniosek, lokalizacje ?? []) };
}
