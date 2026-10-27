import { DOKUMENTY, DYSTRYBUTOR } from "../dystrybutor";
import { KROK_KONCOWY } from "../slowniki";
import { FONT, KOLOR, naglowekMaila } from "./marka";
import { h, INFORMACJA_O_DYSTRYBUTORZE_SKROT, KLAUZULA_RODO_SKROT, type Wiadomosc } from "./potwierdzenie-klienta";

/**
 * Mail do klienta z wnioskiem niezłożonym — dwa warianty tej samej wiadomości:
 *  - „link”: wysyłany od razu po „Zapisz i dokończ później” (link do powrotu),
 *  - „przypomnienie”: po kilku dniach bez złożenia (ręcznie albo automatycznie).
 *
 * Wiadomość czysto usługowa (dotyczy wniosku, który klient sam rozpoczął) — bez banerów
 * i oferty innych produktów. Najważniejsze, co ma z niej wynikać: wniosek NIE został
 * wysłany, a złożenie to ostatni krok formularza i przycisk „Złóż wniosek”.
 * Ten sam układ HTML co potwierdzenie złożenia (tabele, style w atrybutach).
 */

export type DanePrzypomnienia = {
  rodzaj?: "link" | "przypomnienie";
  nazwaFirmy: string;
  /** Pełny link do wniosku (adres aplikacji + /wniosek/<token>). */
  link: string;
  rozpoczeto: Date;
  linkWazny: Date | null;
  /** Adres aplikacji — logo i dokumenty (nota RODO, informacja o dystrybutorze). */
  adresAplikacji: string;
  logo: string;
};

const data = (d: Date) =>
  d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

export function mailPrzypomnienieKlienta(d: DanePrzypomnienia): Wiadomosc {
  const link = d.rodzaj === "link";
  const temat = link
    ? "Link do Twojego wniosku o ubezpieczenie majątkowe — wniosek nie jest jeszcze złożony"
    : "Twój wniosek o ubezpieczenie majątkowe nie został jeszcze złożony";
  const zapowiedz = link
    ? "Wniosek zapisany. Wróć przez ten link, a na koniec kliknij „Złóż wniosek”."
    : "Dane są zapisane. Do złożenia brakuje ostatniego kroku: zakres, zgody, podpis i przycisk „Złóż wniosek”.";
  const etykieta = link ? "Wniosek zapisany — niezłożony" : "Wniosek niezłożony";
  const tytul = link ? "Dokończ wniosek, kiedy chcesz" : "Twój wniosek czeka na złożenie";
  const wstep = link
    ? "jest zapisany. Możesz wrócić do niego w dowolnej chwili przez przycisk poniżej. <strong>Wniosek nie został jeszcze złożony</strong> — trafi do agenta dopiero po kliknięciu „Złóż wniosek” w ostatnim kroku."
    : "jest zapisany, ale <strong>nie został jeszcze złożony</strong>. Nie trafił więc do agenta i nie możemy przygotować oferty.";
  const wstepTekst = link
    ? "jest zapisany. Możesz wrócić do niego w dowolnej chwili przez link poniżej. WNIOSEK NIE ZOSTAŁ JESZCZE ZŁOŻONY — trafi do agenta dopiero po kliknięciu „Złóż wniosek” w ostatnim kroku."
    : "jest zapisany, ale NIE ZOSTAŁ JESZCZE ZŁOŻONY.\nNie trafił więc do agenta i nie możemy przygotować oferty.";
  const baza = d.adresAplikacji.replace(/\/$/, "");
  const notaRodo = `${baza}/dokumenty/${DOKUMENTY.rodo.plik}`;
  const infoDystrybutor = `${baza}/dokumenty/${DOKUMENTY.dystrybutor.plik}`;
  const firma = d.nazwaFirmy.trim();

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

    ${naglowekMaila({ logo: d.logo, podpis: "Ubezpieczenie majątkowe salonów beauty" }, h)}

    <tr><td style="padding:28px 28px 8px;">
      <div style="${FONT}font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${KOLOR.marka};">${h(etykieta)}</div>
      <h1 style="${FONT}margin:6px 0 16px;font-size:22px;line-height:28px;color:${KOLOR.tekst};">${h(tytul)}</h1>
      <p style="${FONT}margin:0 0 12px;font-size:15px;line-height:22px;color:${KOLOR.tekst};">Dzień dobry,</p>
      <p style="${FONT}margin:0;font-size:15px;line-height:22px;color:${KOLOR.tekst};">
        wniosek o ubezpieczenie majątkowe${firma ? ` dla <strong>${h(firma)}</strong>` : ""}, rozpoczęty ${h(data(d.rozpoczeto))},
        ${wstep}
      </p>
    </td></tr>

    <tr><td style="padding:20px 28px 4px;">
      <div style="${FONT}font-size:16px;font-weight:700;color:${KOLOR.tekst};padding-bottom:6px;">${link ? "Jak złożyć wniosek" : "Do złożenia zostało kilka minut"}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">
        ${krok(1, "Otwórz wniosek przyciskiem poniżej — wpisane dane czekają, nie trzeba zaczynać od nowa.")}
        ${krok(2, `Uzupełnij brakujące dane i przejdź do ostatniego kroku <strong>„${KROK_KONCOWY}”</strong>: zaznacz zakres ubezpieczenia i zgody, wpisz miejscowość i podpisz się palcem albo myszą.`)}
        ${krok(3, "Kliknij <strong>„Złóż wniosek”</strong>. Zaraz potem przyjdzie e-mail z numerem wniosku i kopią w PDF — to znak, że wniosek do nas dotarł.")}
      </table>
    </td></tr>

    <tr><td align="center" style="padding:22px 28px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background:${KOLOR.marka};">
          <a href="${h(d.link)}" target="_blank" rel="noopener" style="${FONT}display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Dokończ wniosek</a>
        </td></tr>
      </table>
      ${d.linkWazny ? `<p style="${FONT}margin:10px 0 0;font-size:12px;color:${KOLOR.szary};">Link jest ważny do ${h(data(d.linkWazny))}.</p>` : ""}
    </td></tr>

    <tr><td style="padding:18px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${KOLOR.linia};border-radius:8px;">
        <tr><td style="${FONT}padding:12px 16px;font-size:13px;line-height:19px;color:${KOLOR.szary};">
          Masz pytania albo wolisz, żeby agent pomógł wypełnić wniosek? Odpowiedz na tę wiadomość
          lub zadzwoń: <strong style="color:${KOLOR.tekst};">${h(DYSTRYBUTOR.telefon)}</strong>.
          Jeśli wniosek nie jest już aktualny, po prostu zignoruj tę wiadomość.
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="background:${KOLOR.tlo};padding:18px 28px;border-top:1px solid ${KOLOR.linia};">
      <p style="${FONT}margin:0 0 4px;font-size:12px;font-weight:600;color:${KOLOR.szary};">Informacja o dystrybutorze</p>
      <p style="${FONT}margin:0 0 12px;font-size:11px;line-height:16px;color:${KOLOR.szary};">${h(INFORMACJA_O_DYSTRYBUTORZE_SKROT)}
        <a href="${h(infoDystrybutor)}" style="color:${KOLOR.marka};">Pełna informacja o dystrybutorze</a>.</p>
      <p style="${FONT}margin:0 0 4px;font-size:12px;font-weight:600;color:${KOLOR.szary};">Ochrona danych osobowych (RODO)</p>
      <p style="${FONT}margin:0 0 12px;font-size:11px;line-height:16px;color:${KOLOR.szary};">${h(KLAUZULA_RODO_SKROT)}
        <a href="${h(notaRodo)}" style="color:${KOLOR.marka};">Pełna nota informacyjna RODO</a>.</p>
      <p style="${FONT}margin:0;font-size:11px;line-height:16px;color:${KOLOR.szaryJasny};">
        Wiadomość dotyczy wniosku rozpoczętego w serwisie ${h(baza.replace(/^https?:\/\//, ""))}. ${link ? "Wysłaliśmy ją, bo zapisano wniosek do dokończenia później." : "Wysyłamy ją, bo wniosek nie został złożony."}
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
    `wniosek o ubezpieczenie majątkowe${firma ? ` dla ${firma}` : ""}, rozpoczęty ${data(d.rozpoczeto)}, ${wstepTekst}`,
    ``,
    link ? `Jak złożyć wniosek:` : `Do złożenia zostało kilka minut:`,
    `1. Otwórz wniosek: ${d.link}`,
    `   Wpisane dane czekają, nie trzeba zaczynać od nowa.`,
    `2. Uzupełnij brakujące dane i przejdź do ostatniego kroku „${KROK_KONCOWY}”: zaznacz zakres ubezpieczenia i zgody, wpisz miejscowość i podpisz się palcem albo myszą.`,
    `3. Kliknij „Złóż wniosek”. Zaraz potem przyjdzie e-mail z numerem wniosku i kopią w PDF.`,
    ...(d.linkWazny ? [``, `Link jest ważny do ${data(d.linkWazny)}.`] : []),
    ``,
    `Masz pytania albo wolisz, żeby agent pomógł wypełnić wniosek? Odpowiedz na tę wiadomość lub zadzwoń: ${DYSTRYBUTOR.telefon}.`,
    `Jeśli wniosek nie jest już aktualny, po prostu zignoruj tę wiadomość.`,
    ``,
    `--`,
    `INFORMACJA O DYSTRYBUTORZE`,
    `${INFORMACJA_O_DYSTRYBUTORZE_SKROT} Pełna informacja: ${infoDystrybutor}`,
    ``,
    `OCHRONA DANYCH OSOBOWYCH (RODO)`,
    `${KLAUZULA_RODO_SKROT} Pełna nota: ${notaRodo}`,
  ].join("\n");

  return { temat, html, tekst };
}
