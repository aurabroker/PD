import { h, type Wiadomosc } from "./potwierdzenie-klienta";
import { FONT, KOLOR, naglowekMaila } from "./marka";

/** Mail do nowego agenta z jednorazowym linkiem do ustawienia hasła. */
export function mailZaproszenieAgenta(d: { imieNazwisko: string; link: string; zaprasza: string; logo: string }): Wiadomosc {
  const temat = "Dostęp do panelu wniosków Aura Expert";

  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(temat)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
    ${naglowekMaila({ logo: d.logo, podpis: "Panel wniosków majątkowych" }, h)}
    <tr><td style="padding:28px;">
      <p style="${FONT}margin:0 0 12px;font-size:15px;line-height:22px;color:#1c1917;">Dzień dobry${d.imieNazwisko ? `, ${h(d.imieNazwisko)}` : ""},</p>
      <p style="${FONT}margin:0 0 20px;font-size:15px;line-height:22px;color:#1c1917;">
        Otrzymujesz dostęp do panelu wniosków o ubezpieczenie majątkowe (zaproszenie: ${h(d.zaprasza)}). Ustaw hasło, żeby się zalogować.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:${KOLOR.marka};">
        <a href="${h(d.link)}" style="${FONT}display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Ustaw hasło</a>
      </td></tr></table>
      <p style="${FONT}margin:20px 0 0;font-size:13px;line-height:19px;color:#57534e;">
        Link jest jednorazowy i ważny przez ograniczony czas. Jeśli wygaśnie, poproś administratora o nowy.
        Jeśli nie spodziewasz się tej wiadomości, zignoruj ją.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const tekst = [
    `Dzień dobry${d.imieNazwisko ? `, ${d.imieNazwisko}` : ""},`,
    ``,
    `Otrzymujesz dostęp do panelu wniosków o ubezpieczenie majątkowe Aura Expert (zaproszenie: ${d.zaprasza}).`,
    `Ustaw hasło, żeby się zalogować: ${d.link}`,
    ``,
    `Link jest jednorazowy i ważny przez ograniczony czas. Jeśli wygaśnie, poproś administratora o nowy.`,
  ].join("\n");

  return { temat, html, tekst };
}
