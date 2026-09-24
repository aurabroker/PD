import { zl } from "../format";
import { DYSTRYBUTOR } from "../dystrybutor";

/**
 * Mail do klienta po złożeniu wniosku.
 *
 * HTML pod klientów poczty: układ na tabelach, style w atrybutach, bez
 * zewnętrznych obrazków i fontów (Outlook, Gmail i telefony renderują to
 * tak samo). Każda wartość od klienta przechodzi przez `h()` — trafia do HTML.
 * Obok HTML-a wersja tekstowa dla programów bez HTML i dla filtrów antyspamowych.
 */

export type DanePotwierdzenia = {
  nrReferencyjny: string;
  nazwaFirmy: string;
  nip: string;
  lokalizacje: { nazwa: string; adres: string; suma: number }[];
  sumaLaczna: number;
  zakres: string[];
  zlozono: Date;
  /** Nazwy plików w załączniku: kopia wniosku (PDF), informacja o dystrybutorze, nota RODO. */
  zalaczniki: string[];
};

export type Wiadomosc = { temat: string; html: string; tekst: string };

const KOLOR = {
  marka: "#8a4838",
  markaJasna: "#fdf5f3",
  markaRamka: "#f7d5cd",
  tekst: "#1c1917",
  szary: "#57534e",
  szaryJasny: "#a8a29e",
  linia: "#e7e5e4",
  tlo: "#f5f5f4",
};

/** Ucieczka HTML — dane klienta nigdy nie trafiają do maila jako znaczniki. */
export const h = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const data = (d: Date) =>
  d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

const FONT = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;`;

function wiersz(etykieta: string, wartoscHtml: string): string {
  return `<tr>
    <td style="${FONT}padding:6px 0;font-size:13px;color:${KOLOR.szary};vertical-align:top;width:42%;">${etykieta}</td>
    <td style="${FONT}padding:6px 0;font-size:14px;color:${KOLOR.tekst};vertical-align:top;">${wartoscHtml}</td>
  </tr>`;
}

const D = DYSTRYBUTOR;

/** Skrót informacji o dystrybutorze — pełna wersja jest w załączonym PDF. */
export const INFORMACJA_O_DYSTRYBUTORZE =
  `${D.nazwa}, ${D.adres}, jest agentem ubezpieczeniowym wpisanym do rejestru pośredników ubezpieczeniowych ` +
  `prowadzonego przez KNF pod numerem ${D.knf} (możesz to sprawdzić na ${D.rejestrKnf.replace("https://", "")}). ` +
  `KRS ${D.krs}, NIP ${D.nip}, REGON ${D.regon}. Kontakt: ${D.email}, tel. ${D.telefon}. ` +
  `Reklamacje: ${D.reklamacje}. Pełna informacja o dystrybutorze — w załączniku.`;

/** Klauzula informacyjna — zgodna z notą RODO Aura Expert (pełna nota w załączniku). */
export const KLAUZULA_RODO =
  `Administratorem Twoich danych osobowych jest ${D.nazwa} z siedzibą w Warszawie (${D.adres}). ` +
  `Dane podane we wniosku przetwarzamy na podstawie Twojej zgody oraz w celu podjęcia działań przed zawarciem umowy ubezpieczenia, ` +
  `czyli żeby przygotować ofertę; w tym zakresie możemy je przekazać zakładom ubezpieczeń. ` +
  `Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia, sprzeciwu, ` +
  `cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem wcześniejszego przetwarzania) oraz skargi do Prezesa UODO. ` +
  `Kontakt z Inspektorem Ochrony Danych: ${D.iod}. Pełna nota informacyjna RODO — w załączniku.`;

export function mailPotwierdzenieKlienta(d: DanePotwierdzenia): Wiadomosc {
  const temat = `Wniosek ${d.nrReferencyjny} przyjęty — ubezpieczenie majątkowe`;
  const zapowiedz = "Dziękujemy. Wniosek trafił do agenta Aura Expert, kopię w PDF przesyłamy w załączniku.";

  const lokalizacjeHtml = d.lokalizacje
    .map(
      (l, i) => `<tr>
        <td style="${FONT}padding:8px 0;border-top:1px solid ${KOLOR.linia};font-size:14px;color:${KOLOR.tekst};">
          <strong>${h(l.nazwa || `Lokalizacja ${i + 1}`)}</strong><br>
          <span style="font-size:13px;color:${KOLOR.szary};">${h(l.adres)}</span>
        </td>
        <td style="${FONT}padding:8px 0;border-top:1px solid ${KOLOR.linia};font-size:14px;color:${KOLOR.tekst};text-align:right;white-space:nowrap;vertical-align:top;">${h(zl(l.suma))}</td>
      </tr>`,
    )
    .join("");

  const zakresHtml = d.zakres.length
    ? d.zakres.map((z) => `&bull;&nbsp;${h(z)}`).join("<br>")
    : `<span style="color:${KOLOR.szaryJasny};">nie wskazano</span>`;

  const krok = (nr: number, tresc: string) => `<tr>
      <td style="${FONT}width:28px;vertical-align:top;padding:4px 0;">
        <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:${KOLOR.markaJasna};border:1px solid ${KOLOR.markaRamka};color:${KOLOR.marka};font-size:12px;font-weight:600;text-align:center;">${nr}</div>
      </td>
      <td style="${FONT}padding:5px 0 5px 8px;font-size:14px;line-height:20px;color:${KOLOR.tekst};">${tresc}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${h(temat)}</title>
</head>
<body style="margin:0;padding:0;background:${KOLOR.tlo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${h(zapowiedz)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KOLOR.tlo};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${KOLOR.linia};">

    <tr><td style="background:${KOLOR.marka};padding:20px 28px;">
      <div style="${FONT}font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Aura Expert</div>
      <div style="${FONT}font-size:12px;color:${KOLOR.markaRamka};margin-top:2px;">Ubezpieczenie majątkowe salonów beauty</div>
    </td></tr>

    <tr><td style="padding:28px 28px 8px;">
      <div style="${FONT}font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${KOLOR.marka};">Wniosek przyjęty</div>
      <h1 style="${FONT}margin:6px 0 16px;font-size:22px;line-height:28px;color:${KOLOR.tekst};">Dziękujemy za złożenie wniosku</h1>
      <p style="${FONT}margin:0 0 12px;font-size:15px;line-height:22px;color:${KOLOR.tekst};">Dzień dobry,</p>
      <p style="${FONT}margin:0;font-size:15px;line-height:22px;color:${KOLOR.tekst};">
        Twój wniosek o ubezpieczenie majątkowe trafił do naszego agenta. Przeanalizuje go i przygotuje dla Ciebie ofertę.
      </p>
    </td></tr>

    <tr><td style="padding:20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KOLOR.markaJasna};border:1px solid ${KOLOR.markaRamka};border-radius:10px;">
        <tr><td style="padding:16px 20px;">
          <div style="${FONT}font-size:12px;color:${KOLOR.szary};">Numer wniosku</div>
          <div style="${FONT}font-size:20px;font-weight:700;color:${KOLOR.marka};letter-spacing:0.5px;margin-top:2px;">${h(d.nrReferencyjny)}</div>
          <div style="${FONT}font-size:12px;color:${KOLOR.szary};margin-top:4px;">złożony ${h(data(d.zlozono))} · podawaj go w kontakcie z nami</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${wiersz("Ubezpieczający", `<strong>${h(d.nazwaFirmy)}</strong>`)}
        ${d.nip ? wiersz("NIP", h(d.nip)) : ""}
        ${wiersz("Zakres ubezpieczenia", zakresHtml)}
      </table>
    </td></tr>

    <tr><td style="padding:16px 28px 0;">
      <div style="${FONT}font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${KOLOR.szary};padding-bottom:4px;">Lokalizacje i sumy ubezpieczenia</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${lokalizacjeHtml}
        <tr>
          <td style="${FONT}padding:10px 0 0;border-top:2px solid ${KOLOR.tekst};font-size:14px;font-weight:700;color:${KOLOR.tekst};">Łączna suma ubezpieczenia</td>
          <td style="${FONT}padding:10px 0 0;border-top:2px solid ${KOLOR.tekst};font-size:15px;font-weight:700;color:${KOLOR.tekst};text-align:right;white-space:nowrap;">${h(zl(d.sumaLaczna))}</td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:28px 28px 8px;">
      <div style="${FONT}font-size:16px;font-weight:700;color:${KOLOR.tekst};padding-bottom:6px;">Co dalej?</div>
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${krok(1, "Agent sprawdzi wniosek. Jeśli czegoś zabraknie, odezwie się do Ciebie.")}
        ${krok(2, "Przygotujemy ofertę dopasowaną do Twojej działalności i lokalizacji.")}
        ${krok(3, "Prześlemy ją na ten adres e-mail — decyzję podejmujesz Ty.")}
      </table>
    </td></tr>

    <tr><td style="padding:16px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${KOLOR.linia};border-radius:8px;">
        <tr><td style="${FONT}padding:12px 16px;font-size:13px;line-height:19px;color:${KOLOR.szary};">
          <strong style="color:${KOLOR.tekst};">W załącznikach:</strong><br>
          ${d.zalaczniki.map((z) => `&bull;&nbsp;${h(z)}`).join("<br>")}
          <div style="margin-top:8px;">Pierwszy plik to kopia wniosku do Twojej dokumentacji. Widzisz błąd? Odpowiedz na tę wiadomość, a agent go poprawi.</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="background:${KOLOR.tlo};padding:18px 28px;border-top:1px solid ${KOLOR.linia};">
      <p style="${FONT}margin:0 0 4px;font-size:12px;font-weight:600;color:${KOLOR.szary};">Informacja o dystrybutorze</p>
      <p style="${FONT}margin:0 0 12px;font-size:11px;line-height:16px;color:${KOLOR.szary};">${h(INFORMACJA_O_DYSTRYBUTORZE)}</p>
      <p style="${FONT}margin:0 0 4px;font-size:12px;font-weight:600;color:${KOLOR.szary};">Ochrona danych osobowych (RODO)</p>
      <p style="${FONT}margin:0 0 12px;font-size:11px;line-height:16px;color:${KOLOR.szary};">${h(KLAUZULA_RODO)}</p>
      <p style="${FONT}margin:0;font-size:11px;line-height:16px;color:${KOLOR.szaryJasny};">
        Wiadomość wysłana automatycznie po złożeniu wniosku ${h(d.nrReferencyjny)}. Jeśli wniosek nie pochodzi od Ciebie, odpowiedz na tę wiadomość.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const tekst = [
    `Dzień dobry,`,
    ``,
    `Twój wniosek o ubezpieczenie majątkowe trafił do naszego agenta. Przeanalizuje go i przygotuje dla Ciebie ofertę.`,
    ``,
    `Numer wniosku: ${d.nrReferencyjny} (złożony ${data(d.zlozono)})`,
    `Ubezpieczający: ${d.nazwaFirmy}${d.nip ? `, NIP ${d.nip}` : ""}`,
    `Zakres: ${d.zakres.join("; ") || "nie wskazano"}`,
    ``,
    `Lokalizacje:`,
    ...d.lokalizacje.map((l, i) => `- ${l.nazwa || `Lokalizacja ${i + 1}`}, ${l.adres}: ${zl(l.suma)}`),
    `Łączna suma ubezpieczenia: ${zl(d.sumaLaczna)}`,
    ``,
    `Co dalej?`,
    `1. Agent sprawdzi wniosek. Jeśli czegoś zabraknie, odezwie się do Ciebie.`,
    `2. Przygotujemy ofertę dopasowaną do Twojej działalności i lokalizacji.`,
    `3. Prześlemy ją na ten adres e-mail — decyzję podejmujesz Ty.`,
    ``,
    `W załącznikach:`,
    ...d.zalaczniki.map((z) => `- ${z}`),
    `Pierwszy plik to kopia wniosku. Widzisz błąd? Odpowiedz na tę wiadomość.`,
    ``,
    `--`,
    `INFORMACJA O DYSTRYBUTORZE`,
    INFORMACJA_O_DYSTRYBUTORZE,
    ``,
    `OCHRONA DANYCH OSOBOWYCH (RODO)`,
    KLAUZULA_RODO,
  ].join("\n");

  return { temat, html, tekst };
}
