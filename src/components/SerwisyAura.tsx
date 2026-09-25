"use client";

import { useEffect, useRef, useState } from "react";
import { SEKCJA_SERWISOW, SERWISY, type Serwis } from "@/lib/serwisy";

/**
 * „Nasze serwisy” na dole stron publicznych. Grafiki leżą na auraexpert.pl —
 * gdy któraś się nie wczyta, zamiast pustej ramki zostaje nazwa serwisu.
 * Bez referera: adres strony „Dziękujemy” zawiera token wniosku.
 */
/** `waska` — dla stron w wąskiej kolumnie (np. „Dziękujemy”): najwyżej 2 karty w rzędzie. */
export default function SerwisyAura({ waska = false }: { waska?: boolean }) {
  const s = SEKCJA_SERWISOW;
  return (
    <section id={s.id} aria-labelledby={`${s.id}-tytul`} className="mt-16 border-t border-stone-200 pt-12">
      <span className="naglowek-sekcji">{s.eyebrow}</span>
      <h2 id={`${s.id}-tytul`} className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
        {s.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">{s.intro}</p>
      <ul className={`mt-6 grid gap-4 sm:grid-cols-2 ${waska ? "" : "lg:grid-cols-4"}`}>
        {SERWISY.map((serwis) => (
          <li key={serwis.label} className="flex">
            <Karta serwis={serwis} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Karta({ serwis }: { serwis: Serwis }) {
  const aktywny = Boolean(serwis.href) && !serwis.soon;
  const tresc = (
    <>
      <Grafika serwis={serwis} />
      <span className="flex flex-1 flex-col p-4">
        <span className="flex items-start justify-between gap-2">
          <span className="font-medium text-stone-900">{serwis.label}</span>
          {serwis.soon && (
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              Wkrótce
            </span>
          )}
        </span>
        <span className="mt-1 text-sm text-stone-600">{serwis.desc}</span>
        {aktywny && (
          <span className="mt-auto pt-3 text-sm font-medium text-marka-700 group-hover:text-marka-900">
            Przejdź <span aria-hidden="true">→</span>
          </span>
        )}
      </span>
    </>
  );

  // Telefon: miniatura obok tekstu (zwarta lista). Od sm: karta z grafiką u góry.
  const klasy = "flex w-full flex-row overflow-hidden rounded-xl border border-stone-200 bg-white sm:flex-col";
  if (!aktywny) {
    return <div className={`${klasy} opacity-80`} aria-disabled="true">{tresc}</div>;
  }
  return (
    <a
      href={serwis.href!}
      target="_blank"
      rel="noopener noreferrer"
      className={`group ${klasy} transition hover:-translate-y-0.5 hover:border-marka-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-500`}
    >
      {tresc}
    </a>
  );
}

function Grafika({ serwis }: { serwis: Serwis }) {
  const [blad, setBlad] = useState(false);
  const obraz = useRef<HTMLImageElement>(null);

  // Błąd sprzed hydracji (obrazek z HTML serwera) — decode() czeka na wynik ładowania.
  // Bez loading="lazy": decode() niepobranego jeszcze leniwego obrazka jest odrzucane,
  // co dawało fałszywą ikonę zamiast grafiki.
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

  const logo = serwis.kind === "logo";
  return (
    <span
      className={`relative flex w-28 shrink-0 items-center justify-center border-r border-stone-100 sm:aspect-[16/9] sm:w-auto sm:border-b sm:border-r-0 ${
        logo ? "bg-white" : "bg-stone-100"
      }`}
    >
      {blad ? (
        // Nazwa serwisu jest obok — tu tylko neutralny znak, żeby nie powtarzać tekstu.
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 text-marka-200">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
          />
        </svg>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- grafiki z auraexpert.pl, bez optymalizacji Next
        <img
          ref={obraz}
          src={serwis.img}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBlad(true)}
          className={
            logo
              ? "max-h-[60%] max-w-[75%] object-contain"
              : "absolute inset-0 h-full w-full object-cover"
          }
        />
      )}
    </span>
  );
}
