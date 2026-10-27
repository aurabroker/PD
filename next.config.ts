import type { NextConfig } from "next";

/**
 * Nagłówki bezpieczeństwa dla każdej odpowiedzi.
 *
 * Bez pełnego CSP (lista źródeł skryptów) — Turnstile, Supabase i grafiki z auraexpert.pl
 * wymagałyby osobnej, przetestowanej listy. Tu tylko to, co nie może niczego zepsuć:
 * zakaz osadzania w cudzej ramce (formularz i okno podpisu), HSTS, nosniff,
 * odcięcie kamery/mikrofonu/lokalizacji i ograniczony Referer.
 */
const NAGLOWKI_BEZPIECZENSTWA = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: NAGLOWKI_BEZPIECZENSTWA }];
  },
};

export default nextConfig;
