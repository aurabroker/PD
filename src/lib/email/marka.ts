/**
 * Wspólny wygląd maili: kolory z logo Aura Expert i nagłówek z logo.
 *
 * Logo to PNG pod publicznym adresem aplikacji (/marka/aura-expert-email.png) —
 * WebP nie wszędzie działa, a obrazka z załącznika inline klienci poczty nie
 * pokazują jednakowo. Gdy program blokuje obrazki, alt jest stylowany jak logo.
 */
export const KOLOR = {
  marka: "#00769f", // tekst i przyciski (kontrast z białym 5,1:1)
  akcent: "#00a4dc", // kolor z logo — pasek pod nagłówkiem
  markaJasna: "#eef9fd",
  markaRamka: "#b0e3f5",
  tekst: "#1c1917",
  szary: "#57534e",
  szaryJasny: "#a8a29e",
  linia: "#e7e5e4",
  tlo: "#f5f5f4",
} as const;

export const FONT = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;`;

/** Adres logo do maili — z adresu aplikacji, z którego wychodzi wysyłka. */
export const adresLogo = (adresAplikacji: string) => `${adresAplikacji.replace(/\/$/, "")}/marka/aura-expert-email.png`;

/** Wiersz nagłówka maila: logo po lewej, podpis po prawej, niebieski pasek pod spodem. */
export function naglowekMaila(o: { logo: string; podpis: string }, ucieczka: (v: unknown) => string): string {
  const h = ucieczka;
  return `<tr><td style="background:#ffffff;padding:20px 28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <img src="${h(o.logo)}" width="150" height="75" alt="Aura Expert" style="display:block;width:150px;height:auto;border:0;${FONT}font-size:20px;font-weight:700;color:${KOLOR.marka};">
        </td>
        <td style="vertical-align:middle;text-align:right;${FONT}font-size:12px;line-height:17px;color:${KOLOR.szary};">${h(o.podpis)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${KOLOR.akcent};">&nbsp;</td></tr>`;
}
