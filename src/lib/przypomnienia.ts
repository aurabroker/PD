import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { wyslijEmail } from "./email/wyslij";
import { adresLogo } from "./email/marka";
import { mailPrzypomnienieKlienta } from "./email/przypomnienie-klienta";
import { sprawdzAdresEmail } from "./email-adres";
import { zapiszHistorie } from "./historia";

/**
 * Maile do klientów z wnioskiem niezłożonym:
 *  - link do wniosku — na żądanie klienta („Zapisz i dokończ później”),
 *  - przypomnienia — automatycznie (cron Workera, raz dziennie), najwyżej dwa na wniosek.
 *
 * Powód (10.2026): klienci wypełniali dane firmy, lokalizację i sprzęt, klikali „Zapisz”
 * i wychodzili w przekonaniu, że wniosek poszedł. Link do powrotu był tylko w pasku adresu.
 */

export const TYP_LINK = "link_do_wniosku";
export const TYP_PRZYPOMNIENIE = "przypomnienie_klienta";

const GODZINA = 60 * 60 * 1000;
const DZIEN = 24 * GODZINA;

/** Ile linków do jednego wniosku w ciągu doby — formularz nie może służyć do zasypywania skrzynki. */
const LIMIT_LINKOW_NA_DOBE = 3;
/** Ten sam adres w tym czasie nie dostaje drugiego linku (wielokrotne kliknięcie „Zapisz”). */
const PRZERWA_MIEDZY_LINKAMI = 15 * 60 * 1000;

/** Pierwsze przypomnienie po tylu dniach bez zmian we wniosku; drugie po tylu dniach od pierwszego. */
export const ZASADY_PRZYPOMNIEN = { poDniachBezZmian: 2, drugiePoDniach: 7, najwyzej: 2 } as const;
/**
 * Na jeden przebieg crona. Worker na planie darmowym ma limit 50 zapytań wychodzących
 * na wywołanie; jeden wniosek to do 4 (status poprzedniego maila, wysyłka, dziennik, historia).
 */
const MAKS_NA_PRZEBIEG = 8;

const replyTo = () => process.env.RESEND_REPLY_TO || undefined;

export type WynikLinku =
  | { wyslano: true; adres: string; link: string }
  | { wyslano: false; powod: "brak_emaila" | "zly_email" | "niedawno" | "limit" | "zlozony" | "blad"; adres?: string; sugestia?: string; link: string };

/** Link do wniosku na adres z wniosku. Nie rzuca — wynik mówi, co się stało. */
export async function wyslijLinkDoWniosku(token: string, adresAplikacji: string): Promise<WynikLinku> {
  const baza = adresAplikacji.replace(/\/$/, "");
  const link = `${baza}/wniosek/${token}`;
  const supabase = supabaseAdmin();

  const { data: w } = await supabase
    .from("mienie_wnioski")
    .select("id, status, nazwa_firmy, email_kontaktowy, created_at, token_wygasa")
    .eq("form_token", token)
    .maybeSingle();
  if (!w) return { wyslano: false, powod: "blad", link };
  if (w.status !== "roboczy") return { wyslano: false, powod: "zlozony", link };

  const adres = String(w.email_kontaktowy ?? "").trim().toLowerCase();
  const sprawdzenie = sprawdzAdresEmail(adres);
  if (sprawdzenie.stan === "pusty") return { wyslano: false, powod: "brak_emaila", link };
  if (sprawdzenie.stan === "zly_format") return { wyslano: false, powod: "zly_email", adres, link };
  if (sprawdzenie.stan === "podejrzany") return { wyslano: false, powod: "zly_email", adres, sugestia: sprawdzenie.sugestia, link };

  const { data: ostatnie } = await supabase
    .from("mienie_emaile")
    .select("do_kogo, status, created_at")
    .eq("wniosek_id", w.id)
    .eq("typ", TYP_LINK)
    .gte("created_at", new Date(Date.now() - DZIEN).toISOString());
  const udane = (ostatnie ?? []).filter((e) => e.status === "wyslany");
  if (udane.some((e) => e.do_kogo === adres && Date.now() - new Date(e.created_at).getTime() < PRZERWA_MIEDZY_LINKAMI)) {
    return { wyslano: false, powod: "niedawno", adres, link };
  }
  if ((ostatnie ?? []).length >= LIMIT_LINKOW_NA_DOBE) return { wyslano: false, powod: "limit", adres, link };

  const m = mailPrzypomnienieKlienta({
    rodzaj: "link",
    nazwaFirmy: w.nazwa_firmy ?? "",
    link,
    rozpoczeto: new Date(w.created_at),
    linkWazny: w.token_wygasa ? new Date(w.token_wygasa) : null,
    adresAplikacji: baza,
    logo: adresLogo(baza),
  });
  const wynik = await wyslijEmail({ do: adres, temat: m.temat, html: m.html, tekst: m.tekst, typ: TYP_LINK, wniosekId: w.id, replyTo: replyTo() });
  if (!wynik.ok) return { wyslano: false, powod: "blad", adres, link };
  await zapiszHistorie(w.id, null, "email", { typ: TYP_LINK, do: adres, resend_id: wynik.id });
  return { wyslano: true, adres, link };
}

type Kandydat = {
  id: string;
  nr_referencyjny: string;
  nazwa_firmy: string | null;
  nip: string | null;
  email_kontaktowy: string | null;
  form_token: string;
  created_at: string;
  updated_at: string;
  token_wygasa: string | null;
};

type MailWniosku = { id: number; wniosek_id: string; typ: string; do_kogo: string; status: string; blad: string | null; resend_id: string | null; created_at: string };

export type DecyzjaPrzypomnienia = { nr: string; decyzja: "wyslane" | "do_wyslania" | "pominiete" | "blad"; powod?: string };

/** Status maila w Resend („bounced” = adres nie istnieje). Null, gdy nie da się sprawdzić. */
async function statusWResend(id: string): Promise<string | null> {
  const klucz = process.env.RESEND_API_KEY;
  if (!klucz) return null;
  try {
    const odp = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${klucz}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!odp.ok) return null;
    const j = (await odp.json()) as { last_event?: string };
    return j.last_event ?? null;
  } catch {
    return null;
  }
}

const cyfry = (v: string | null) => String(v ?? "").replace(/\D/g, "");

/**
 * Jeden przebieg przypomnień. `proba` — tylko lista decyzji, bez wysyłki.
 *
 * Kto dostaje przypomnienie: wniosek roboczy z poprawnym adresem e-mail i ważnym linkiem
 * (z datą ważności — szkice sprzed września 2026 jej nie mają i są pomijane), bez zmian
 * od 2 dni, bez linku wysłanego w tym czasie, z mniej niż dwoma przypomnieniami
 * (drugie najwcześniej 7 dni po pierwszym). Pomijamy adresy, na które poprzedni mail
 * wrócił jako niedoręczalny, oraz klientów, którzy złożyli już inny wniosek (ten sam e-mail albo NIP).
 */
export async function przebiegPrzypomnien(adresAplikacji: string, o: { proba?: boolean; teraz?: Date } = {}): Promise<DecyzjaPrzypomnienia[]> {
  const teraz = o.teraz ?? new Date();
  const baza = adresAplikacji.replace(/\/$/, "");
  const supabase = supabaseAdmin();
  const decyzje: DecyzjaPrzypomnienia[] = [];

  const { data: kandydaci, error } = await supabase
    .from("mienie_wnioski")
    .select("id, nr_referencyjny, nazwa_firmy, nip, email_kontaktowy, form_token, created_at, updated_at, token_wygasa")
    .eq("status", "roboczy")
    .not("token_wygasa", "is", null)
    .gt("token_wygasa", new Date(teraz.getTime() + DZIEN).toISOString())
    .lte("updated_at", new Date(teraz.getTime() - ZASADY_PRZYPOMNIEN.poDniachBezZmian * DZIEN).toISOString())
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`Odczyt wniosków: ${error.message}`);
  const lista = ((kandydaci ?? []) as Kandydat[]).filter((k) => sprawdzAdresEmail(k.email_kontaktowy).stan === "ok");
  if (!lista.length) return decyzje;

  const [{ data: maile }, { data: zlozone }] = await Promise.all([
    supabase
      .from("mienie_emaile")
      .select("id, wniosek_id, typ, do_kogo, status, blad, resend_id, created_at")
      .in("wniosek_id", lista.map((k) => k.id))
      .in("typ", [TYP_LINK, TYP_PRZYPOMNIENIE])
      .order("created_at", { ascending: false }),
    supabase.from("mienie_wnioski").select("nip, email_kontaktowy, created_at").neq("status", "roboczy"),
  ]);
  const mailePo = new Map<string, MailWniosku[]>();
  for (const m of (maile ?? []) as MailWniosku[]) mailePo.set(m.wniosek_id, [...(mailePo.get(m.wniosek_id) ?? []), m]);

  let wyslanych = 0;
  for (const k of lista) {
    const adres = String(k.email_kontaktowy).trim().toLowerCase();
    const pomin = (powod: string) => decyzje.push({ nr: k.nr_referencyjny, decyzja: "pominiete", powod });
    const jego = mailePo.get(k.id) ?? [];

    if (jego.some((m) => m.do_kogo === adres && m.status === "blad" && /bounce|odbit/i.test(m.blad ?? ""))) {
      pomin("adres wcześniej odbity");
      continue;
    }
    const innyZlozony = (zlozone ?? []).some(
      (z) => new Date(z.created_at) >= new Date(k.created_at) &&
        ((cyfry(k.nip).length === 10 && cyfry(z.nip) === cyfry(k.nip)) || String(z.email_kontaktowy ?? "").toLowerCase() === adres),
    );
    if (innyZlozony) {
      pomin("klient złożył inny wniosek");
      continue;
    }
    const przypomnienia = jego.filter((m) => m.typ === TYP_PRZYPOMNIENIE && m.status === "wyslany");
    if (przypomnienia.length >= ZASADY_PRZYPOMNIEN.najwyzej) {
      pomin("wysłano już dwa przypomnienia");
      continue;
    }
    const ostatniePrzypomnienie = przypomnienia[0];
    if (ostatniePrzypomnienie && teraz.getTime() - new Date(ostatniePrzypomnienie.created_at).getTime() < ZASADY_PRZYPOMNIEN.drugiePoDniach * DZIEN) {
      pomin("drugie przypomnienie dopiero 7 dni po pierwszym");
      continue;
    }
    const ostatniLink = jego.find((m) => m.typ === TYP_LINK && m.status === "wyslany");
    if (ostatniLink && teraz.getTime() - new Date(ostatniLink.created_at).getTime() < ZASADY_PRZYPOMNIEN.poDniachBezZmian * DZIEN) {
      pomin("link wysłany niedawno");
      continue;
    }
    if (wyslanych >= MAKS_NA_PRZEBIEG) {
      pomin("limit przebiegu — w następnym");
      continue;
    }

    // Poprzedni mail na ten adres wrócił? Wtedy nie wysyłamy i zaznaczamy to w dzienniku i historii.
    const poprzedni = jego.find((m) => m.do_kogo === adres && m.status === "wyslany" && m.resend_id);
    if (poprzedni?.resend_id && (await statusWResend(poprzedni.resend_id)) === "bounced") {
      if (!o.proba) {
        await supabase.from("mienie_emaile")
          .update({ status: "blad", blad: "Odbity przez serwer odbiorcy (bounce) — adres e-mail we wniosku prawdopodobnie błędny" })
          .eq("id", poprzedni.id);
        await zapiszHistorie(k.id, null, "email", { typ: poprzedni.typ, do: adres, resend_id: poprzedni.resend_id, odbity: true });
      }
      pomin("poprzedni mail odbity");
      continue;
    }

    if (o.proba) {
      decyzje.push({ nr: k.nr_referencyjny, decyzja: "do_wyslania" });
      wyslanych++;
      continue;
    }
    const m = mailPrzypomnienieKlienta({
      rodzaj: "przypomnienie",
      nazwaFirmy: k.nazwa_firmy ?? "",
      link: `${baza}/wniosek/${k.form_token}`,
      rozpoczeto: new Date(k.created_at),
      linkWazny: k.token_wygasa ? new Date(k.token_wygasa) : null,
      adresAplikacji: baza,
      logo: adresLogo(baza),
    });
    const wynik = await wyslijEmail({ do: adres, temat: m.temat, html: m.html, tekst: m.tekst, typ: TYP_PRZYPOMNIENIE, wniosekId: k.id, replyTo: replyTo() });
    if (wynik.ok) {
      wyslanych++;
      await zapiszHistorie(k.id, null, "email", { typ: TYP_PRZYPOMNIENIE, do: adres, resend_id: wynik.id, automatyczne: true, ktore: przypomnienia.length + 1 });
      decyzje.push({ nr: k.nr_referencyjny, decyzja: "wyslane" });
    } else {
      decyzje.push({ nr: k.nr_referencyjny, decyzja: "blad", powod: wynik.blad.slice(0, 200) });
    }
  }
  return decyzje;
}
