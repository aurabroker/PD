import { zl } from "../format";
import { h, type Wiadomosc } from "./potwierdzenie-klienta";
import { FONT, KOLOR, naglowekMaila } from "./marka";

/**
 * Maile do zespołu o wnioskach, których klient nie złożył:
 *  - próba złożenia zatrzymana przez braki (od razu — klient chciał złożyć),
 *  - codzienne zestawienie nowych niedokończonych wniosków.
 *
 * Wcześniej zespół dowiadywał się tylko o wnioskach złożonych — niedokończone
 * było widać wyłącznie w panelu, do którego nikt nie zaglądał w tym celu.
 */

export type SzkicDlaZespolu = {
  nr: string;
  firma: string;
  nip: string;
  email: string;
  telefon: string;
  osoba: string;
  rozpoczeto: Date;
  zmiana: Date;
  lokalizacje: number;
  suma: number;
  zakres: number;
  zgody: boolean;
  zalozylAgent: boolean;
  /** Komunikaty z ostatniej nieudanej próby złożenia (pusta lista = nie próbował). */
  proby: number;
  zatrzymaly: string[];
  /** Maile do klienta, np. „link 13.11”, „przypomnienie 16.11”. */
  maileDoKlienta: string[];
  link: string;
};

const kiedy = (d: Date) =>
  d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

const ramaHtml = (temat: string, logo: string, podpis: string, tresc: string) => `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(temat)}</title></head>
<body style="margin:0;padding:0;background:${KOLOR.tlo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KOLOR.tlo};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid ${KOLOR.linia};overflow:hidden;">
    ${naglowekMaila({ logo, podpis }, h)}
    ${tresc}
  </table>
</td></tr></table>
</body></html>`;

const kontakt = (s: Pick<SzkicDlaZespolu, "nip" | "telefon" | "email" | "osoba">) =>
  [s.osoba, s.telefon, s.email, s.nip ? `NIP ${s.nip}` : ""].filter(Boolean);

const postep = (s: SzkicDlaZespolu) =>
  [
    `lokalizacje: ${s.lokalizacje}`,
    `suma ${zl(s.suma)}`,
    s.zakres ? `zakres: ${s.zakres} poz.` : "zakres: nie zaznaczony",
    s.zgody ? "zgody: tak" : "zgody: nie",
  ].join(" · ");

function kartaHtml(s: SzkicDlaZespolu): string {
  const wiersz = (tresc: string, kolor: string = KOLOR.szary) =>
    `<div style="${FONT}font-size:13px;line-height:19px;color:${kolor};margin-top:3px;">${tresc}</div>`;
  return `<tr><td style="padding:10px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${KOLOR.linia};border-radius:10px;">
      <tr><td style="padding:12px 14px;">
        <div style="${FONT}font-size:15px;font-weight:700;color:${KOLOR.tekst};">${h(s.firma || "(bez nazwy firmy)")}</div>
        <div style="${FONT}font-size:12px;color:${KOLOR.szary};">${h(s.nr)}${s.zalozylAgent ? " · założony przez agenta" : ""}</div>
        ${wiersz(kontakt(s).map(h).join(" · ") || "brak danych kontaktowych", KOLOR.tekst)}
        ${wiersz(`Rozpoczęty ${h(kiedy(s.rozpoczeto))}, ostatnia zmiana ${h(kiedy(s.zmiana))}`)}
        ${wiersz(h(postep(s)))}
        ${s.proby ? wiersz(`<strong>Próby złożenia: ${s.proby}×</strong> — zatrzymało: ${s.zatrzymaly.map(h).join("; ") || "braki w polach"}`, "#92400e") : ""}
        ${s.maileDoKlienta.length ? wiersz(`Maile do klienta: ${s.maileDoKlienta.map(h).join(", ")}`) : ""}
        <div style="margin-top:8px;"><a href="${h(s.link)}" style="${FONT}font-size:13px;font-weight:600;color:${KOLOR.marka};">Otwórz w panelu →</a></div>
      </td></tr>
    </table>
  </td></tr>`;
}

function kartaTekst(s: SzkicDlaZespolu): string[] {
  return [
    `${s.firma || "(bez nazwy firmy)"} — ${s.nr}${s.zalozylAgent ? " (założony przez agenta)" : ""}`,
    `  ${kontakt(s).join(" · ") || "brak danych kontaktowych"}`,
    `  Rozpoczęty ${kiedy(s.rozpoczeto)}, ostatnia zmiana ${kiedy(s.zmiana)}`,
    `  ${postep(s)}`,
    ...(s.proby ? [`  Próby złożenia: ${s.proby}× — zatrzymało: ${s.zatrzymaly.join("; ") || "braki w polach"}`] : []),
    ...(s.maileDoKlienta.length ? [`  Maile do klienta: ${s.maileDoKlienta.join(", ")}`] : []),
    `  ${s.link}`,
  ];
}

/** Codzienne zestawienie: nowe niedokończone wnioski + lista zgłoszonych wcześniej, wciąż otwartych. */
export function mailZestawienieSzkicow(d: {
  nowe: SzkicDlaZespolu[];
  wczesniej: { nr: string; firma: string; zmiana: Date; link: string }[];
  logo: string;
  dzis: Date;
}): Wiadomosc {
  const data = d.dzis.toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
  const temat = `Niedokończone wnioski: ${d.nowe.length} ${d.nowe.length === 1 ? "nowy" : "nowe"} (${data})`;
  const wstep =
    "Te wnioski zostały rozpoczęte, ale nie złożone — nie trafiły więc do puli złożonych. " +
    "Telefon zwykle wystarcza, żeby je dokończyć. Automatyczne przypomnienia mailem też wychodzą.";

  const wczesniejHtml = d.wczesniej.length
    ? `<tr><td style="padding:14px 28px 4px;">
        <div style="${FONT}font-size:14px;font-weight:700;color:${KOLOR.tekst};">Zgłoszone wcześniej, nadal niezłożone (${d.wczesniej.length})</div>
        ${d.wczesniej.slice(0, 15).map((w) => `<div style="${FONT}font-size:13px;line-height:20px;color:${KOLOR.szary};">
          <a href="${h(w.link)}" style="color:${KOLOR.marka};">${h(w.nr)}</a> — ${h(w.firma || "(bez nazwy)")}, ostatnia zmiana ${h(kiedy(w.zmiana))}</div>`).join("")}
        ${d.wczesniej.length > 15 ? `<div style="${FONT}font-size:13px;color:${KOLOR.szary};">…i ${d.wczesniej.length - 15} więcej w panelu.</div>` : ""}
      </td></tr>`
    : "";

  const html = ramaHtml(temat, d.logo, "Niedokończone wnioski · panel wniosków majątkowych", `
    <tr><td style="padding:22px 28px 6px;">
      <div style="${FONT}font-size:19px;font-weight:700;color:${KOLOR.tekst};">${h(temat)}</div>
      <p style="${FONT}margin:8px 0 0;font-size:14px;line-height:20px;color:${KOLOR.szary};">${h(wstep)}</p>
    </td></tr>
    ${d.nowe.map(kartaHtml).join("")}
    ${wczesniejHtml}
    <tr><td style="padding:16px 28px 24px;">
      <p style="${FONT}margin:0;font-size:12px;line-height:17px;color:${KOLOR.szaryJasny};">
        Zestawienie przychodzi codziennie ok. 9:05, tylko gdy pojawiły się nowe niedokończone wnioski
        (bez zmian od co najmniej 3 godzin, z danymi firmy albo kontaktu). Każdy wniosek trafia do „nowych” raz.
      </p>
    </td></tr>`);

  const tekst = [
    temat,
    ``,
    wstep,
    ``,
    ...d.nowe.flatMap((s) => [...kartaTekst(s), ``]),
    ...(d.wczesniej.length
      ? [`Zgłoszone wcześniej, nadal niezłożone (${d.wczesniej.length}):`,
         ...d.wczesniej.slice(0, 15).map((w) => `- ${w.nr} — ${w.firma || "(bez nazwy)"}, ostatnia zmiana ${kiedy(w.zmiana)}: ${w.link}`)]
      : []),
  ].join("\n");

  return { temat, html, tekst };
}

/** Od razu po nieudanej próbie złożenia — klient chciał złożyć, zatrzymały go braki. */
export function mailProbaZlozenia(d: { szkic: SzkicDlaZespolu; logo: string }): Wiadomosc {
  const s = d.szkic;
  const temat = `Nieudana próba złożenia wniosku — ${s.firma || s.nr}`;
  const wstep =
    "Po kliknięciu „Złóż wniosek” formularz zatrzymał wniosek z powodu braków. Wniosek NIE jest złożony. " +
    "Jeśli braki nie zostaną poprawione, warto zadzwonić — dane kontaktowe poniżej.";
  const html = ramaHtml(temat, d.logo, "Próba złożenia · panel wniosków majątkowych", `
    <tr><td style="padding:22px 28px 6px;">
      <div style="${FONT}font-size:19px;font-weight:700;color:${KOLOR.tekst};">${h(temat)}</div>
      <p style="${FONT}margin:8px 0 0;font-size:14px;line-height:20px;color:${KOLOR.szary};">${h(wstep)}</p>
    </td></tr>
    ${kartaHtml(s)}
    <tr><td style="padding:12px 28px 24px;">
      <p style="${FONT}margin:0;font-size:12px;line-height:17px;color:${KOLOR.szaryJasny};">
        O kolejnych próbach tego samego wniosku powiadomimy najwcześniej po 24 godzinach.
      </p>
    </td></tr>`);
  const tekst = [temat, ``, wstep, ``, ...kartaTekst(s)].join("\n");
  return { temat, html, tekst };
}
