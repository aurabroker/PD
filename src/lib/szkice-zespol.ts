import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { wyslijEmail } from "./email/wyslij";
import { adresLogo } from "./email/marka";
import { mailProbaZlozenia, mailZestawienieSzkicow, type SzkicDlaZespolu } from "./email/szkice-zespol";
import { pobierzAgentow } from "./statystyki";
import { TYP_LINK, TYP_PRZYPOMNIENIE } from "./przypomnienia";
import { sprawdzAdresAplikacji } from "./adres-aplikacji";

/**
 * Zespół dowiaduje się o wnioskach, których klient nie złożył (11.2026: przez trzy
 * tygodnie żaden wniosek nie został złożony, a zespół nie dostał o tym ani słowa).
 *
 *  - próba złożenia zatrzymana przez braki → mail od razu (najwyżej raz na dobę na wniosek),
 *  - codziennie (cron Workera, razem z przypomnieniami) → zestawienie nowych niedokończonych
 *    wniosków: bez zmian od 3 godzin, z danymi firmy albo kontaktu, z ostatnich 30 dni.
 *    Każdy wniosek trafia do „nowych” raz (wpis „zgloszony_zespolowi” w historii).
 */

export const TYP_PROBA_ZESPOL = "proba_zlozenia_zespol";
export const TYP_ZESTAWIENIE = "zestawienie_szkicow";

const GODZINA = 60 * 60 * 1000;
const DZIEN = 24 * GODZINA;
const SZKIC_BEZ_ZMIAN_GODZIN = 3;
const SZKICE_Z_DNI = 30;

const KOLUMNY =
  "id, nr_referencyjny, status, nazwa_firmy, nip, email_kontaktowy, telefon, osoba_kontaktu, created_at, updated_at, zakres, zgoda_rodo, suma_lacznie, zrodlo";

type Wiersz = {
  id: string;
  nr_referencyjny: string;
  status: string;
  nazwa_firmy: string | null;
  nip: string | null;
  email_kontaktowy: string | null;
  telefon: string | null;
  osoba_kontaktu: string | null;
  created_at: string;
  updated_at: string;
  zakres: unknown;
  zgoda_rodo: boolean | null;
  suma_lacznie: number | null;
  zrodlo: string | null;
};

const txt = (v: string | null) => String(v ?? "").trim();
const maDane = (w: Wiersz) => [w.nazwa_firmy, w.nip, w.email_kontaktowy, w.telefon].some((v) => txt(v));
const dzien = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "Europe/Warsaw" });

/** Błąd walidacji po ludzku: „Lokalizacja 1: Wybierz piętro z listy”. */
export function opisBledu(sciezka: string, komunikat: string): string {
  const [glowa, nr] = sciezka.split(".");
  const i = nr === undefined ? NaN : Number(nr);
  const gdzie =
    glowa === "lokalizacje" && Number.isInteger(i) ? `Lokalizacja ${i + 1}`
    : glowa === "sprzet_medyczny" && Number.isInteger(i) ? `Sprzęt medyczny, poz. ${i + 1}`
    : glowa === "elektronika_eei" && Number.isInteger(i) ? `Elektronika, poz. ${i + 1}`
    : glowa === "podpis" ? "Podpis"
    : "";
  return gdzie ? `${gdzie}: ${komunikat}` : komunikat;
}

async function adresyZespolu(): Promise<string[]> {
  return (await pobierzAgentow()).filter((a) => a.aktywny && a.email).map((a) => a.email);
}

/** Wnioski z kontaktem, postępem, próbami złożenia i mailami do klienta — do maili zespołu. */
async function szczegoly(wiersze: Wiersz[], baza: string): Promise<SzkicDlaZespolu[]> {
  const ids = wiersze.map((w) => w.id);
  const supabase = supabaseAdmin();
  const [{ data: lok }, { data: proby }, { data: maile }] = await Promise.all([
    supabase.from("mienie_lokalizacje").select("wniosek_id").in("wniosek_id", ids),
    supabase.from("mienie_historia").select("wniosek_id, szczegoly")
      .in("wniosek_id", ids).eq("zdarzenie", "proba_zlozenia").order("created_at", { ascending: true }),
    supabase.from("mienie_emaile").select("wniosek_id, typ, created_at")
      .in("wniosek_id", ids).in("typ", [TYP_LINK, TYP_PRZYPOMNIENIE]).eq("status", "wyslany")
      .order("created_at", { ascending: true }),
  ]);
  return wiersze.map((w) => {
    const jegoProby = (proby ?? []).filter((p) => p.wniosek_id === w.id);
    const ostatnia = (jegoProby.at(-1)?.szczegoly ?? {}) as { komunikaty?: unknown; pola?: unknown };
    const zatrzymaly = Array.isArray(ostatnia.komunikaty) ? ostatnia.komunikaty.map(String)
      : Array.isArray(ostatnia.pola) ? ostatnia.pola.map(String) : [];
    return {
      nr: w.nr_referencyjny,
      firma: txt(w.nazwa_firmy),
      nip: txt(w.nip),
      email: txt(w.email_kontaktowy),
      telefon: txt(w.telefon),
      osoba: txt(w.osoba_kontaktu),
      rozpoczeto: new Date(w.created_at),
      zmiana: new Date(w.updated_at),
      lokalizacje: (lok ?? []).filter((l) => l.wniosek_id === w.id).length,
      suma: Number(w.suma_lacznie) || 0,
      zakres: Array.isArray(w.zakres) ? w.zakres.length : 0,
      zgody: Boolean(w.zgoda_rodo),
      zalozylAgent: w.zrodlo === "agent",
      proby: jegoProby.length,
      zatrzymaly: zatrzymaly.slice(0, 8),
      maileDoKlienta: (maile ?? []).filter((m) => m.wniosek_id === w.id)
        .map((m) => `${m.typ === TYP_LINK ? "link" : "przypomnienie"} ${dzien(m.created_at)}`),
      link: `${baza}/admin/wnioski/${w.id}`,
    };
  });
}

/**
 * Klient kliknął „Złóż wniosek”, formularz go zatrzymał — zespół dostaje maila od razu.
 * Najwyżej raz na dobę na wniosek (klient poprawiający braki klika kilka razy). Nie rzuca.
 */
export async function powiadomZespolOProbie(wniosekId: string, komunikaty: string[], adresAplikacji: string): Promise<void> {
  try {
    const baza = sprawdzAdresAplikacji(adresAplikacji);
    const supabase = supabaseAdmin();
    const { count } = await supabase
      .from("mienie_emaile")
      .select("id", { count: "exact", head: true })
      .eq("wniosek_id", wniosekId)
      .eq("typ", TYP_PROBA_ZESPOL)
      .gte("created_at", new Date(Date.now() - DZIEN).toISOString());
    if ((count ?? 0) > 0) return;

    const { data: w } = await supabase.from("mienie_wnioski").select(KOLUMNY).eq("id", wniosekId).maybeSingle<Wiersz>();
    if (!w || w.status !== "roboczy") return;
    const zespol = await adresyZespolu();
    if (!zespol.length) return;

    const [szkic] = await szczegoly([w], baza);
    const m = mailProbaZlozenia({ szkic: { ...szkic, zatrzymaly: komunikaty.slice(0, 8) }, logo: adresLogo(baza) });
    await wyslijEmail({
      do: zespol, ...m, typ: TYP_PROBA_ZESPOL, wniosekId,
      ...(txt(w.email_kontaktowy) ? { replyTo: txt(w.email_kontaktowy) } : {}),
    });
  } catch (e) {
    console.error("[szkice-zespol] proba:", e instanceof Error ? e.message : e);
  }
}

export type WynikZestawienia = { nowe: string[]; wczesniej: number; wyslano: boolean; blad?: string };

/** Codzienne zestawienie niedokończonych wniosków dla zespołu. `proba` — bez wysyłki i bez oznaczania. */
export async function zestawienieSzkicow(adresAplikacji: string, o: { proba?: boolean; teraz?: Date } = {}): Promise<WynikZestawienia> {
  const teraz = o.teraz ?? new Date();
  const baza = sprawdzAdresAplikacji(adresAplikacji);
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("mienie_wnioski")
    .select(KOLUMNY)
    .eq("status", "roboczy")
    .gte("created_at", new Date(teraz.getTime() - SZKICE_Z_DNI * DZIEN).toISOString())
    .lte("updated_at", new Date(teraz.getTime() - SZKIC_BEZ_ZMIAN_GODZIN * GODZINA).toISOString())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Odczyt wniosków: ${error.message}`);
  const kandydaci = ((data ?? []) as Wiersz[]).filter(maDane);
  if (!kandydaci.length) return { nowe: [], wczesniej: 0, wyslano: false };

  const { data: zgloszone, error: e2 } = await supabase
    .from("mienie_historia")
    .select("wniosek_id")
    .in("wniosek_id", kandydaci.map((k) => k.id))
    .eq("zdarzenie", "zgloszony_zespolowi");
  if (e2) throw new Error(`Odczyt historii: ${e2.message}`);
  const juz = new Set((zgloszone ?? []).map((z) => z.wniosek_id));
  const nowe = kandydaci.filter((k) => !juz.has(k.id));
  const wczesniej = kandydaci.filter((k) => juz.has(k.id));
  const wynik: WynikZestawienia = { nowe: nowe.map((n) => n.nr_referencyjny), wczesniej: wczesniej.length, wyslano: false };
  if (!nowe.length || o.proba) return wynik;

  const zespol = await adresyZespolu();
  if (!zespol.length) return { ...wynik, blad: "Brak aktywnych agentów z adresem e-mail" };

  const m = mailZestawienieSzkicow({
    nowe: await szczegoly(nowe, baza),
    wczesniej: wczesniej.map((w) => ({ nr: w.nr_referencyjny, firma: txt(w.nazwa_firmy), zmiana: new Date(w.updated_at), link: `${baza}/admin/wnioski/${w.id}` })),
    logo: adresLogo(baza),
    dzis: teraz,
  });
  const wysylka = await wyslijEmail({ do: zespol, ...m, typ: TYP_ZESTAWIENIE, wniosekId: null });
  if (!wysylka.ok) return { ...wynik, blad: wysylka.blad.slice(0, 200) };

  // Oznaczamy dopiero po udanej wysyłce — nieudana zostawia wnioski „nowymi” na jutro.
  const { error: e3 } = await supabase.from("mienie_historia").insert(
    nowe.map((n) => ({ wniosek_id: n.id, kto: null, zdarzenie: "zgloszony_zespolowi", szczegoly: { resend_id: wysylka.id } })),
  );
  if (e3) console.error("[szkice-zespol] oznaczenie zgłoszonych:", e3.message);
  return { ...wynik, wyslano: true };
}
