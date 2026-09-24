"use client";

import { useEffect, useRef, useState } from "react";
import type { Baner } from "@/lib/email/promo";

/**
 * Baner utratadochodu.pl na stronie „Dziękujemy”. Grafika leży na innej
 * domenie — gdy się nie wczyta (brak pliku, blokada), zamiast pustej ramki
 * pokazujemy kartę tekstową z tym samym linkiem.
 */
/** Baner zajmuje szerokość treści: pełny ekran telefonu, najwyżej ~640 px na komputerze. */
const ROZMIARY = "(max-width: 672px) 100vw, 640px";

export default function BanerPromo({ baner }: { baner: Baner }) {
  const [blad, setBlad] = useState(false);
  const obraz = useRef<HTMLImageElement>(null);

  // Błąd ładowania mógł wystąpić, zanim React podpiął onError (obrazek z HTML
  // renderowanego na serwerze). `complete` + `naturalWidth` nie wystarcza: przy
  // <picture> przeglądarka bywa „complete” jeszcze przed pobraniem pliku.
  // decode() czeka na faktyczny wynik i odrzuca tylko uszkodzony obrazek.
  useEffect(() => {
    const img = obraz.current;
    if (!img) return;
    let aktywny = true;
    img.decode().catch(() => {
      if (aktywny && img.naturalWidth === 0) setBlad(true);
    });
    return () => {
      aktywny = false;
    };
  }, []);

  return (
    <a
      href={baner.href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 block overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:border-marka-300"
      data-oferta={baner.obraz}
      data-oferta-stan={blad ? "tekst" : "grafika"}
    >
      {blad ? (
        <span className="flex items-center justify-between gap-4 p-5">
          <span>
            <span className="block text-xs font-medium uppercase tracking-wide text-marka-700">Może Cię zainteresować</span>
            <span className="mt-1 block font-semibold text-stone-900">Ubezpieczenie od utraty dochodu</span>
            <span className="mt-0.5 block text-sm text-stone-600">Sprawdź ofertę na utratadochodu.pl</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-marka-700" aria-hidden="true">→</span>
        </span>
      ) : (
        <picture>
          {baner.srcsetWebp && <source type="image/webp" srcSet={baner.srcsetWebp} sizes={ROZMIARY} />}
          {/* eslint-disable-next-line @next/next/no-img-element -- warianty z workera banery, bez optymalizacji Next */}
          <img
            ref={obraz}
            src={baner.obraz}
            srcSet={baner.srcsetJpg}
            sizes={baner.srcsetJpg ? ROZMIARY : undefined}
            width={1200}
            height={628}
            alt={baner.alt}
            referrerPolicy="no-referrer"
            className="block h-auto w-full"
            onError={() => setBlad(true)}
          />
        </picture>
      )}
    </a>
  );
}
