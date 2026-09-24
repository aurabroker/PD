import "server-only";
import { DOKUMENTY } from "./dystrybutor";
import { mailNowyWniosekAgent } from "./email/nowy-wniosek-agent";
import { mailPotwierdzenieKlienta } from "./email/potwierdzenie-klienta";
import { PROMO } from "./email/promo";
import { wyslijEmail, type Zalacznik } from "./email/wyslij";
import { numerDoPliku } from "./numeracja";
import { base64NaBajty, generujPdfWniosku } from "./pdf/wniosek-pdf";
import { DOKUMENT_DYSTRYBUTOR, DOKUMENT_RODO } from "./pdf/zasoby.generated";
import { sumaLokalizacji, sumaWniosku } from "./schema";
import { pobierzAgentow } from "./statystyki";
import { pobierzWniosekPoId } from "./wnioski";

/**
 * Maile po złożeniu wniosku:
 *  - klient: potwierdzenie + kopia wniosku (PDF) + informacja o dystrybutorze + nota RODO,
 *  - zespół (aktywni agenci i administratorzy): powiadomienie z linkiem do panelu i kopią PDF.
 *
 * Nigdy nie rzuca: wniosek jest już złożony, a nieudana wysyłka nie może tego
 * cofnąć ani pokazać klientowi błędu. Każda próba ląduje w mienie_emaile,
 * a nieudane widać w zakładce Health.
 */

/** Nazwa pliku PDF z kopią wniosku, np. „Wniosek PD-24092026-K7M2QX.pdf”. */
export const nazwaPdfWniosku = (nr: string) => `Wniosek ${numerDoPliku(nr)}.pdf`;

export async function powiadomOZlozeniu(wniosekId: string, adresAplikacji: string): Promise<void> {
  try {
    const wynik = await pobierzWniosekPoId(wniosekId);
    if (!wynik) {
      console.error("[powiadomienia] brak wniosku", wniosekId);
      return;
    }
    const { meta, dane } = wynik;
    const nr: string = meta.nr_referencyjny;
    const zlozono = meta.wyslano_at ? new Date(meta.wyslano_at) : new Date();

    const pdf = await generujPdfWniosku({ dane, nrReferencyjny: nr, zlozono });
    const kopia: Zalacznik = { nazwa: nazwaPdfWniosku(nr), tresc: pdf };
    const replyTo = process.env.RESEND_REPLY_TO || undefined;

    // Kolejno, nie równolegle: Resend ogranicza liczbę żądań na sekundę.
    if (dane.email_kontaktowy) {
      const zalaczniki: Zalacznik[] = [
        kopia,
        { nazwa: DOKUMENTY.dystrybutor.nazwa, tresc: base64NaBajty(DOKUMENT_DYSTRYBUTOR) },
        { nazwa: DOKUMENTY.rodo.nazwa, tresc: base64NaBajty(DOKUMENT_RODO) },
      ];
      const mail = mailPotwierdzenieKlienta({
        nrReferencyjny: nr,
        nazwaFirmy: dane.nazwa_firmy,
        nip: dane.nip,
        lokalizacje: dane.lokalizacje.map((l) => ({ nazwa: l.nazwa, adres: l.adres, suma: sumaLokalizacji(l) })),
        sumaLaczna: sumaWniosku(dane),
        zakres: dane.zakres,
        zlozono,
        zalaczniki: zalaczniki.map((z) => z.nazwa),
        promo: PROMO.obraz ? { ...PROMO, obraz: `${adresAplikacji}${PROMO.obraz}` } : null,
      });
      await wyslijEmail({
        do: dane.email_kontaktowy,
        ...mail,
        typ: "potwierdzenie_klienta",
        wniosekId,
        replyTo,
        zalaczniki,
      });
    }

    const zespol = (await pobierzAgentow()).filter((a) => a.aktywny && a.email).map((a) => a.email);
    if (zespol.length > 0) {
      const mail = mailNowyWniosekAgent({
        nrReferencyjny: nr,
        nazwaFirmy: dane.nazwa_firmy,
        nip: dane.nip,
        email: dane.email_kontaktowy,
        telefon: dane.telefon,
        zakres: dane.zakres,
        liczbaLokalizacji: dane.lokalizacje.length,
        sumaLaczna: sumaWniosku(dane),
        zrodlo: meta.zrodlo,
        link: `${adresAplikacji}/admin/wnioski/${meta.id}`,
      });
      await wyslijEmail({
        do: zespol,
        ...mail,
        typ: "nowy_wniosek_agent",
        wniosekId,
        zalaczniki: [kopia],
        ...(dane.email_kontaktowy ? { replyTo: dane.email_kontaktowy } : {}),
      });
    }
  } catch (e) {
    console.error("[powiadomienia] wyjatek:", e instanceof Error ? e.stack ?? e.message : e);
  }
}
