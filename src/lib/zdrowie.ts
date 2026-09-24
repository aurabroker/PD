import "server-only";
import { sprawdzPolaczenieGus } from "./regon";
import { rolaKluczaSerwisowego, supabaseAdmin } from "./supabase/admin";
import { WERSJA } from "./wersja.generated";

/**
 * Zakładka Health: czy wszystko, od czego zależy przyjmowanie wniosków, działa.
 *
 * Każde sprawdzenie odpytuje usługę naprawdę (nie tylko „czy klucz jest
 * wpisany”): baza, zamknięcie danych przed kluczem publicznym, logowanie,
 * Turnstile, GUS, Resend z domeną nadawcy, nieudane wysyłki maili.
 *
 *  - „blad”  — wymaga interwencji; zakładka Health świeci na czerwono,
 *  - „uwaga” — warto wiedzieć, ale nic nie jest zepsute,
 *  - „ok”.
 *
 * Sprawy operacyjne (wniosek czeka na agenta) celowo NIE są tutaj — trafiają do
 * „Wymaga uwagi” na stronie głównej. Health czerwony przez każdy czekający
 * wniosek byłby czerwony stale, a stale czerwonej lampki nikt nie czyta.
 */

export type Stan = "ok" | "uwaga" | "blad";

export type Sprawdzenie = {
  id: string;
  grupa: "Infrastruktura" | "Bezpieczeństwo" | "Integracje" | "Panel";
  nazwa: string;
  stan: Stan;
  opis: string;
  ms: number;
};

export type Raport = {
  stan: "ok" | "blad";
  sprawdzono: string;
  wersja: typeof WERSJA;
  sprawdzenia: Sprawdzenie[];
};

const LIMIT_MS = 6000;

async function sprawdz(
  id: string,
  grupa: Sprawdzenie["grupa"],
  nazwa: string,
  fn: () => Promise<{ stan: Stan; opis: string }>,
): Promise<Sprawdzenie> {
  const start = Date.now();
  try {
    const wynik = await Promise.race([
      fn(),
      new Promise<never>((_, odrzuc) =>
        setTimeout(() => odrzuc(new Error(`brak odpowiedzi w ${LIMIT_MS / 1000} s`)), LIMIT_MS),
      ),
    ]);
    return { id, grupa, nazwa, ...wynik, ms: Date.now() - start };
  } catch (e) {
    return { id, grupa, nazwa, stan: "blad", opis: e instanceof Error ? e.message : String(e), ms: Date.now() - start };
  }
}

const URL_SUPABASE = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Czy tabela jest zamknięta przed kluczem publicznym (anon) — tak ma zostać po lockdownie RLS. */
async function zamknietaDlaAnon(tabela: string): Promise<boolean> {
  const odp = await fetch(`${URL_SUPABASE()}/rest/v1/${tabela}?select=*&limit=1`, {
    headers: { apikey: ANON(), Authorization: `Bearer ${ANON()}` },
  });
  if (!odp.ok) return true; // 401/403/404 — brak dostępu
  const wiersze = (await odp.json().catch(() => [])) as unknown[];
  return Array.isArray(wiersze) && wiersze.length === 0;
}

async function wykonaj(): Promise<Raport> {
  const baza = supabaseAdmin();

  const sprawdzenia = await Promise.all([
    sprawdz("baza", "Infrastruktura", "Baza danych", async () => {
      const start = Date.now();
      const { error, count } = await baza.from("mienie_wnioski").select("id", { count: "exact", head: true });
      if (error) return { stan: "blad", opis: `Brak połączenia: ${error.message}` };
      const ms = Date.now() - start;
      return { stan: ms > 3000 ? "uwaga" : "ok", opis: `Połączenie działa (${ms} ms), wniosków: ${count ?? 0}.` };
    }),

    sprawdz("klucz", "Infrastruktura", "Klucz serwisowy Supabase", async () => {
      const k = rolaKluczaSerwisowego();
      return k.poprawna
        ? { stan: "ok", opis: "SUPABASE_SERVICE_ROLE_KEY ma rolę service_role." }
        : { stan: "blad", opis: `Zły klucz (${k.rozpoznana}). ${k.uwaga ?? ""}` };
    }),

    sprawdz("schemat", "Infrastruktura", "Schemat bazy (migracje)", async () => {
      const braki: string[] = [];
      const kolumny = await baza
        .from("mienie_wnioski")
        .select("import_zgodnosc, przypisany_agent, status_zmieniony_at, polisa_skladka")
        .limit(1);
      if (kolumny.error) braki.push(`kolumny wniosków (${kolumny.error.message})`);
      for (const t of ["mienie_agenci", "mienie_historia", "mienie_emaile"]) {
        const { error } = await baza.from(t).select("*", { head: true, count: "exact" });
        if (error) braki.push(`tabela ${t}`);
      }
      return braki.length
        ? { stan: "blad", opis: `Brakuje: ${braki.join(", ")} — nie zastosowano migracji z supabase/migrations.` }
        : { stan: "ok", opis: "Wszystkie wymagane tabele i kolumny są na miejscu." };
    }),

    sprawdz("logowanie", "Infrastruktura", "Logowanie (Supabase Auth)", async () => {
      const odp = await fetch(`${URL_SUPABASE()}/auth/v1/health`, { headers: { apikey: ANON() } });
      return odp.ok
        ? { stan: "ok", opis: "Serwer logowania odpowiada." }
        : { stan: "blad", opis: `Serwer logowania zwraca HTTP ${odp.status}.` };
    }),

    sprawdz("rls", "Bezpieczeństwo", "Dane zamknięte przed kluczem publicznym", async () => {
      const tabele = ["mienie_wnioski", "mienie_lokalizacje", "mienie_agenci", "mienie_historia", "mienie_emaile"];
      const otwarte: string[] = [];
      for (const t of tabele) if (!(await zamknietaDlaAnon(t))) otwarte.push(t);
      return otwarte.length
        ? { stan: "blad", opis: `PUBLICZNIE DOSTĘPNE: ${otwarte.join(", ")} — natychmiast przywróć RLS (migracja lockdown).` }
        : { stan: "ok", opis: `Klucz publiczny (anon) nie widzi żadnego wiersza w ${tabele.length} tabelach.` };
    }),

    sprawdz("turnstile", "Bezpieczeństwo", "Ochrona przed botami (Turnstile)", async () => {
      const sekret = process.env.TURNSTILE_SECRET_KEY;
      if (!sekret) return { stan: "blad", opis: "Brak TURNSTILE_SECRET_KEY — start wniosku i import nie są chronione." };
      const cialo = new URLSearchParams({ secret: sekret, response: "sprawdzenie-health" });
      const odp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: cialo });
      const w = (await odp.json()) as { "error-codes"?: string[] };
      const kody = w["error-codes"] ?? [];
      if (kody.includes("invalid-input-secret")) return { stan: "blad", opis: "Cloudflare odrzuca TURNSTILE_SECRET_KEY — zły sekret." };
      return { stan: "ok", opis: "Cloudflare przyjmuje sekret (testowy token odrzucony, jak powinien)." };
    }),

    sprawdz("gus", "Integracje", "Rejestr REGON (GUS)", async () => {
      const w = await sprawdzPolaczenieGus();
      return { stan: !w.ok ? "blad" : w.test ? "uwaga" : "ok", opis: w.opis };
    }),

    sprawdz("resend", "Integracje", "Poczta (Resend)", async () => {
      const klucz = process.env.RESEND_API_KEY;
      const nadawca = process.env.RESEND_SENDER ?? "";
      if (!klucz || !nadawca) {
        return { stan: "blad", opis: `Brak ${!klucz ? "RESEND_API_KEY" : "RESEND_SENDER"} — maile nie wychodzą.` };
      }
      const domena = nadawca.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
      const odp = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${klucz}` } });
      const tresc = (await odp.json().catch(() => ({}))) as {
        data?: { name: string; status: string }[];
        message?: string;
        name?: string;
      };
      if (odp.status === 401 && /restricted/i.test(`${tresc.name} ${tresc.message}`)) {
        return {
          stan: "uwaga",
          opis: `Klucz ma uprawnienie tylko do wysyłki — nie da się sprawdzić domeny ${domena}. Wysyłki kontroluje sprawdzenie „Wysłane e-maile”.`,
        };
      }
      if (!odp.ok) return { stan: "blad", opis: `Resend odrzuca klucz: HTTP ${odp.status} ${tresc.message ?? ""}`.trim() };
      const d = tresc.data?.find((x) => x.name.toLowerCase() === domena);
      if (!d) return { stan: "blad", opis: `Domeny ${domena} nie ma w Resend — maile z ${nadawca} nie wyjdą.` };
      return d.status === "verified"
        ? { stan: "ok", opis: `Domena ${domena} zweryfikowana, nadawca: ${nadawca}.` }
        : { stan: "blad", opis: `Domena ${domena} ma status „${d.status}” — dokończ weryfikację DNS w Resend.` };
    }),

    sprawdz("maile", "Integracje", "Wysłane e-maile (ostatnie 24 h)", async () => {
      const od = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await baza
        .from("mienie_emaile")
        .select("status, blad, typ, created_at")
        .gte("created_at", od)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return { stan: "blad", opis: `Nie da się odczytać dziennika: ${error.message}` };
      const bledy = (data ?? []).filter((m) => m.status === "blad");
      if (bledy.length) {
        return { stan: "blad", opis: `${bledy.length} z ${data!.length} nieudanych. Ostatni błąd: ${bledy[0].blad}` };
      }
      return { stan: "ok", opis: data!.length ? `${data!.length} wysłanych, bez błędów.` : "Brak wysyłek w tym czasie." };
    }),

    sprawdz("admini", "Panel", "Administratorzy panelu", async () => {
      const { count, error } = await baza
        .from("mienie_agenci")
        .select("user_id", { count: "exact", head: true })
        .eq("rola", "admin")
        .eq("aktywny", true);
      if (error) return { stan: "blad", opis: error.message };
      return (count ?? 0) > 0
        ? { stan: "ok", opis: `Aktywnych administratorów: ${count}.` }
        : { stan: "blad", opis: "Brak aktywnego administratora — nikt nie może zarządzać agentami." };
    }),
  ]);

  return {
    stan: sprawdzenia.some((s) => s.stan === "blad") ? "blad" : "ok",
    sprawdzono: new Date().toISOString(),
    wersja: WERSJA,
    sprawdzenia,
  };
}

const WAZNOSC_MS = 5 * 60 * 1000;
let pamiec: { czas: number; raport: Promise<Raport> } | null = null;

/**
 * Raport z pamięci instancji (5 min) — wskaźnik w zakładce nie odpytuje GUS
 * i Resend przy każdym kliknięciu w panelu. `wymus` = przycisk „Sprawdź teraz”.
 */
export function raportZdrowia(wymus = false): Promise<Raport> {
  if (!wymus && pamiec && Date.now() - pamiec.czas < WAZNOSC_MS) return pamiec.raport;
  const raport = wykonaj();
  pamiec = { czas: Date.now(), raport };
  raport.catch(() => {
    pamiec = null;
  });
  return raport;
}
