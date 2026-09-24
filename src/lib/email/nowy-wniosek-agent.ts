import { zl } from "../format";
import { h, type Wiadomosc } from "./potwierdzenie-klienta";

/** Powiadomienie zespołu o nowym złożonym wniosku (kopia PDF w załączniku). */
export function mailNowyWniosekAgent(d: {
  nrReferencyjny: string;
  nazwaFirmy: string;
  nip: string;
  email: string;
  telefon: string;
  zakres: string[];
  liczbaLokalizacji: number;
  sumaLaczna: number;
  zrodlo: string;
  link: string;
}): Wiadomosc {
  const zrodlo = { web: "formularz online", excel: "import pliku Excel", agent: "wniosek założony przez agenta" }[d.zrodlo] ?? d.zrodlo;
  const temat = `Nowy wniosek ${d.nrReferencyjny} — ${d.nazwaFirmy}`;
  const FONT = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;`;
  const wiersz = (etykieta: string, wartosc: string) => `<tr>
      <td style="${FONT}padding:5px 0;font-size:13px;color:#57534e;vertical-align:top;width:38%;">${etykieta}</td>
      <td style="${FONT}padding:5px 0;font-size:14px;color:#1c1917;vertical-align:top;">${wartosc}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(temat)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
    <tr><td style="background:#8a4838;padding:18px 28px;">
      <div style="${FONT}font-size:18px;font-weight:700;color:#ffffff;">Nowy wniosek</div>
      <div style="${FONT}font-size:12px;color:#f7d5cd;margin-top:2px;">Panel wniosków majątkowych Aura Expert</div>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;">
      <div style="${FONT}font-size:20px;font-weight:700;color:#8a4838;">${h(d.nrReferencyjny)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        ${wiersz("Ubezpieczający", `<strong>${h(d.nazwaFirmy)}</strong>`)}
        ${d.nip ? wiersz("NIP", h(d.nip)) : ""}
        ${wiersz("Kontakt", `${h(d.email)}${d.telefon ? `<br>${h(d.telefon)}` : ""}`)}
        ${wiersz("Zakres", d.zakres.map(h).join("<br>") || "—")}
        ${wiersz("Lokalizacje", String(d.liczbaLokalizacji))}
        ${wiersz("Łączna suma", `<strong>${h(zl(d.sumaLaczna))}</strong>`)}
        ${wiersz("Źródło", h(zrodlo))}
      </table>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#8a4838;">
        <a href="${h(d.link)}" style="${FONT}display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Otwórz w panelu</a>
      </td></tr></table>
      <p style="${FONT}margin:16px 0 0;font-size:13px;line-height:19px;color:#57534e;">
        Wniosek czeka w puli nieprzypisanych — przejmij go w panelu. Kopia PDF w załączniku.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const tekst = [
    `Nowy wniosek ${d.nrReferencyjny}`,
    ``,
    `Ubezpieczający: ${d.nazwaFirmy}${d.nip ? `, NIP ${d.nip}` : ""}`,
    `Kontakt: ${d.email}${d.telefon ? `, ${d.telefon}` : ""}`,
    `Zakres: ${d.zakres.join("; ") || "—"}`,
    `Lokalizacje: ${d.liczbaLokalizacji}, łączna suma: ${zl(d.sumaLaczna)}`,
    `Źródło: ${zrodlo}`,
    ``,
    `Otwórz w panelu: ${d.link}`,
    `Kopia PDF w załączniku.`,
  ].join("\n");

  return { temat, html, tekst };
}
