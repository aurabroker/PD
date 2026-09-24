"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { mailZaproszenieAgenta } from "@/lib/email/zaproszenie-agenta";
import { wyslijEmail } from "@/lib/email/wyslij";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WynikAgenta =
  | { ok: true; komunikat: string; link?: string; emailWyslany?: boolean }
  | { ok: false; blad: string };

/** Adres aplikacji do linków w mailach — z żądania admina, nie ze zmiennej builda. */
async function adresAplikacji(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protokol = h.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return `${protokol}://${host}`;
}

/**
 * Jednorazowy link do ustawienia hasła. Generujemy go kluczem serwisowym
 * (bez wysyłki przez pocztę Supabase — ta dociera tylko do członków zespołu
 * projektu) i wysyłamy własnym mailem przez Resend.
 *
 * Nowy adres → link typu „invite” (tworzy konto), istniejący → „recovery”.
 * Link prowadzi na stronę z formularzem, a token jest zużywany dopiero po
 * kliknięciu „Ustaw hasło” — skanery linków w poczcie (np. Outlook) otwierają
 * adres z maila i zużyłyby token, gdyby wystarczało samo wejście.
 */
async function linkDoHasla(email: string): Promise<{ ok: true; userId: string; link: string } | { ok: false; blad: string }> {
  const admin = supabaseAdmin().auth.admin;

  let wynik = await admin.generateLink({ type: "invite", email });
  if (wynik.error && (wynik.error.code === "email_exists" || /already been registered/i.test(wynik.error.message))) {
    wynik = await admin.generateLink({ type: "recovery", email });
  }
  if (wynik.error || !wynik.data?.user) {
    return { ok: false, blad: `Nie udało się przygotować konta: ${wynik.error?.message ?? "brak danych"}` };
  }

  const { hashed_token, verification_type } = wynik.data.properties;
  const link = `${await adresAplikacji()}/auth/ustaw-haslo?token_hash=${encodeURIComponent(hashed_token)}&type=${encodeURIComponent(verification_type)}`;
  return { ok: true, userId: wynik.data.user.id, link };
}

async function wyslijZaproszenie(o: { email: string; imie: string; link: string; zaprasza: string }) {
  const mail = mailZaproszenieAgenta({ imieNazwisko: o.imie, link: o.link, zaprasza: o.zaprasza });
  return wyslijEmail({ do: o.email, ...mail, typ: "zaproszenie_agenta" });
}

const nowyAgent = z.object({
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail").max(320),
  imie_nazwisko: z.string().trim().min(3, "Podaj imię i nazwisko").max(120),
  rola: z.enum(["admin", "agent"]),
});

export async function akcjaDodajAgenta(dane: unknown): Promise<WynikAgenta> {
  const sesja = await wymaganyAdmin();
  if (!sesja) return { ok: false, blad: "Tylko administrator może dodawać agentów." };

  const wynik = nowyAgent.safeParse(dane);
  if (!wynik.success) return { ok: false, blad: wynik.error.issues.map((i) => i.message).join(" · ") };
  const { email, imie_nazwisko, rola } = wynik.data;

  const baza = supabaseAdmin();
  const { data: istniejacy } = await baza
    .from("mienie_agenci")
    .select("user_id, aktywny")
    .eq("email", email)
    .maybeSingle();
  if (istniejacy?.aktywny) return { ok: false, blad: "Ten agent już jest na liście." };

  const link = await linkDoHasla(email);
  if (!link.ok) return link;

  const { error } = await baza.from("mienie_agenci").upsert(
    { user_id: link.userId, email, imie_nazwisko, rola, aktywny: true, utworzyl: sesja.agent.user_id },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, blad: `Nie udało się zapisać agenta: ${error.message}` };

  const mail = await wyslijZaproszenie({
    email,
    imie: imie_nazwisko,
    link: link.link,
    zaprasza: sesja.agent.imie_nazwisko || sesja.agent.email,
  });

  revalidatePath("/admin/agenci");
  return {
    ok: true,
    komunikat: mail.ok
      ? `Dodano ${imie_nazwisko}. Link do ustawienia hasła poszedł na ${email}.`
      : `Dodano ${imie_nazwisko}, ale e-mail nie wyszedł (${mail.blad}). Przekaż link poniżej.`,
    link: link.link,
    emailWyslany: mail.ok,
  };
}

/** Nowy link do ustawienia hasła — gdy poprzedni wygasł albo agent zapomniał hasła. */
export async function akcjaNowyLinkHasla(userId: string): Promise<WynikAgenta> {
  const sesja = await wymaganyAdmin();
  if (!sesja) return { ok: false, blad: "Tylko administrator może wysyłać linki." };

  const { data: agent } = await supabaseAdmin()
    .from("mienie_agenci")
    .select("email, imie_nazwisko, aktywny")
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return { ok: false, blad: "Nie znaleziono agenta." };
  if (!agent.aktywny) return { ok: false, blad: "Agent jest nieaktywny — najpierw go aktywuj." };

  const link = await linkDoHasla(agent.email);
  if (!link.ok) return link;

  const mail = await wyslijZaproszenie({
    email: agent.email,
    imie: agent.imie_nazwisko,
    link: link.link,
    zaprasza: sesja.agent.imie_nazwisko || sesja.agent.email,
  });
  return {
    ok: true,
    komunikat: mail.ok ? `Nowy link poszedł na ${agent.email}.` : `E-mail nie wyszedł (${mail.blad}). Przekaż link poniżej.`,
    link: link.link,
    emailWyslany: mail.ok,
  };
}

/** Liczba aktywnych adminów — nie pozwalamy odebrać panelu ostatniemu. */
async function aktywniAdmini(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("mienie_agenci")
    .select("user_id", { count: "exact", head: true })
    .eq("rola", "admin")
    .eq("aktywny", true);
  return count ?? 0;
}

export async function akcjaZmienRole(userId: string, rola: string): Promise<WynikAgenta> {
  const sesja = await wymaganyAdmin();
  if (!sesja) return { ok: false, blad: "Tylko administrator może zmieniać role." };
  if (rola !== "admin" && rola !== "agent") return { ok: false, blad: "Nieznana rola." };
  if (userId === sesja.agent.user_id && rola !== "admin") {
    return { ok: false, blad: "Nie możesz odebrać roli administratora samemu sobie." };
  }
  if (rola === "agent" && (await aktywniAdmini()) <= 1) {
    return { ok: false, blad: "To ostatni administrator — najpierw nadaj tę rolę komuś innemu." };
  }

  const { error } = await supabaseAdmin().from("mienie_agenci").update({ rola }).eq("user_id", userId);
  if (error) return { ok: false, blad: error.message };
  revalidatePath("/admin/agenci");
  return { ok: true, komunikat: rola === "admin" ? "Nadano rolę administratora." : "Zmieniono rolę na agenta." };
}

/**
 * Dezaktywacja odcina dostęp od razu (bramka sprawdza `aktywny` przy każdym
 * żądaniu), a otwarte wnioski agenta wracają do puli, żeby nie utknęły.
 * Konto logowania zostaje — ponowna aktywacja przywraca dostęp.
 */
export async function akcjaUstawAktywnosc(userId: string, aktywny: boolean): Promise<WynikAgenta> {
  const sesja = await wymaganyAdmin();
  if (!sesja) return { ok: false, blad: "Tylko administrator może zmieniać dostęp agentów." };
  if (!aktywny && userId === sesja.agent.user_id) {
    return { ok: false, blad: "Nie możesz dezaktywować samego siebie." };
  }

  const baza = supabaseAdmin();
  if (!aktywny) {
    const { data: cel } = await baza.from("mienie_agenci").select("rola").eq("user_id", userId).maybeSingle();
    if (cel?.rola === "admin" && (await aktywniAdmini()) <= 1) {
      return { ok: false, blad: "To ostatni administrator — nie można go dezaktywować." };
    }
  }

  const { error } = await baza.from("mienie_agenci").update({ aktywny }).eq("user_id", userId);
  if (error) return { ok: false, blad: error.message };

  let zwrocone = 0;
  if (!aktywny) {
    const { data } = await baza
      .from("mienie_wnioski")
      .update({ przypisany_agent: null })
      .eq("przypisany_agent", userId)
      .in("status", ["zlozony", "w_ocenie", "wyceniony", "zaakceptowany"])
      .select("id");
    zwrocone = data?.length ?? 0;
  }

  revalidatePath("/admin/agenci");
  revalidatePath("/admin");
  return {
    ok: true,
    komunikat: aktywny
      ? "Agent aktywny — może się zalogować."
      : `Agent zdezaktywowany.${zwrocone ? ` ${zwrocone} otwartych wniosków wróciło do puli.` : ""}`,
  };
}
