import type { Metadata } from "next";
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
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <a href="/" className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tracking-tight text-marka-900">
                  Aura Expert
                </span>
                <span className="text-sm text-stone-500">Ubezpieczenie majątkowe</span>
              </a>
              <a href="/login" className="text-sm text-stone-500 hover:text-marka-700">
                Panel agenta
              </a>
            </div>
          </header>
          {children}
          <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-stone-500">
            Aura Expert sp. z o.o. — dane z wniosku służą wyłącznie przygotowaniu oferty
            ubezpieczenia.
          </footer>
        </div>
      </body>
    </html>
  );
}
