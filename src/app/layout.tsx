import type { Metadata } from "next";
import { DOKUMENTY, DYSTRYBUTOR } from "@/lib/dystrybutor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wniosek o ubezpieczenie majątkowe — Aura Expert",
  description:
    "Wniosek o ubezpieczenie majątkowe dla salonów beauty i klinik estetycznych. Wypełnij online lub wczytaj wypełniony arkusz Excel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <a href="/" className="flex items-center gap-4" aria-label="Aura Expert — strona główna">
                {/* eslint-disable-next-line @next/next/no-img-element -- mały statyczny plik, bez optymalizacji Next */}
                <img
                  src="/marka/aura-expert-112.webp"
                  srcSet="/marka/aura-expert-112.webp 2x, /marka/aura-expert-168.webp 3x"
                  width={112}
                  height={56}
                  alt="Aura Expert — zmień agenta na experta"
                  className="h-12 w-auto sm:h-14"
                />
                <span className="hidden border-l border-stone-200 pl-4 text-sm leading-tight text-stone-600 sm:block">
                  Ubezpieczenie majątkowe
                  <br />
                  salonów beauty
                </span>
              </a>
              <a href="/login" className="text-sm text-stone-500 hover:text-marka-700">
                Panel agenta
              </a>
            </div>
          </header>
          {children}
          <footer className="mx-auto max-w-5xl space-y-1 px-4 py-10 text-xs text-stone-500">
            <p>
              {DYSTRYBUTOR.nazwa}, {DYSTRYBUTOR.adres} — {DYSTRYBUTOR.forma}, rejestr KNF nr {DYSTRYBUTOR.knf}.
              Dane z wniosku służą wyłącznie przygotowaniu oferty ubezpieczenia.
            </p>
            <p>
              <a href={`/dokumenty/${DOKUMENTY.dystrybutor.plik}`} target="_blank" rel="noopener" className="underline hover:text-marka-700">
                Informacja o dystrybutorze
              </a>
              {" · "}
              <a href={`/dokumenty/${DOKUMENTY.rodo.plik}`} target="_blank" rel="noopener" className="underline hover:text-marka-700">
                Nota informacyjna RODO
              </a>
              {" · "}
              <a href={`mailto:${DYSTRYBUTOR.email}`} className="underline hover:text-marka-700">{DYSTRYBUTOR.email}</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
