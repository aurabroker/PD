"use client";

import { useState, useTransition } from "react";
import { akcjaWeryfikujRegon } from "@/app/actions/wniosek";
import type { DaneRegon } from "@/lib/regon";

/**
 * Weryfikacja firmy po NIP w bazie REGON. Pokazuje oficjalne dane (nazwa, adres,
 * forma prawna, KRS, PKD, status) i jednym kliknięciem uzupełnia nimi formularz.
 */
export default function WeryfikacjaRegon({
  token,
  pobierzNip,
  onZastosuj,
}: {
  /** Token wniosku — bez niego akcja odmawia (klucz GUS nie jest publicznym pośrednikiem). */
  token: string;
  pobierzNip: () => string;
  /** Zwraca listę uzupełnionych pól — pokazujemy ją klientowi. */
  onZastosuj: (dane: DaneRegon) => string[];
}) {
  const [oczekuje, start] = useTransition();
  const [dane, setDane] = useState<DaneRegon | null>(null);
  const [blad, setBlad] = useState("");
  const [uzupelnione, setUzupelnione] = useState<string[] | null>(null);

  function sprawdz() {
    setBlad("");
    setDane(null);
    setUzupelnione(null);
    start(async () => {
      try {
        const wynik = await akcjaWeryfikujRegon(token, pobierzNip());
        if (!wynik.ok) {
          setBlad(wynik.blad);
          return;
        }
        setDane(wynik.dane);
      } catch {
        setBlad("Nie udało się sprawdzić firmy. Spróbuj ponownie za chwilę.");
      }
    });
  }

  const status = !dane
    ? null
    : !dane.aktywna
      ? { tekst: `działalność zakończona${dane.data_zakonczenia ? ` (${dane.data_zakonczenia})` : ""}`, klasa: "text-red-600" }
      : dane.zawieszona
        ? { tekst: "działalność zawieszona", klasa: "text-amber-700" }
        : { tekst: "działalność aktywna", klasa: "text-green-700" };

  const pozostalePkd = dane?.pkd.filter((p) => p !== dane.pkd_glowne) ?? [];

  return (
    <div className="sm:col-span-2">
      <button type="button" onClick={sprawdz} disabled={oczekuje} className="przycisk-drugi text-sm">
        {oczekuje ? "Sprawdzam w REGON…" : "Sprawdź firmę w REGON"}
      </button>

      {blad && <p className="mt-2 text-xs text-red-600">{blad}</p>}

      {dane && status && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          {dane.test && (
            <p className="mb-2 text-xs font-medium text-amber-700">
              Rejestr testowy GUS — dane nie są prawdziwe (brak klucza produkcyjnego).
            </p>
          )}
          <p className="font-medium text-stone-900">{dane.nazwa || "—"}</p>
          {dane.adres && <p className="text-stone-600">{dane.adres}</p>}
          <p className={`mt-1 text-xs font-medium ${status.klasa}`}>{status.tekst}</p>

          <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
            {dane.forma_prawna_gus && (
              <>
                <dt className="text-stone-500">Forma prawna</dt>
                <dd className="text-stone-800">{dane.forma_prawna_gus.toLowerCase()}</dd>
              </>
            )}
            <dt className="text-stone-500">REGON</dt>
            <dd className="text-stone-800">{dane.regon || "—"}</dd>
            {dane.krs && (
              <>
                <dt className="text-stone-500">KRS</dt>
                <dd className="text-stone-800">{dane.krs}</dd>
              </>
            )}
            {dane.data_rozpoczecia && (
              <>
                <dt className="text-stone-500">Działa od</dt>
                <dd className="text-stone-800">{dane.data_rozpoczecia}</dd>
              </>
            )}
            {dane.pkd_glowne && (
              <>
                <dt className="text-stone-500">PKD przeważające</dt>
                <dd className="text-stone-800">
                  {dane.pkd_glowne.kod} — {dane.pkd_glowne.nazwa}
                </dd>
              </>
            )}
            {(dane.email || dane.telefon || dane.www) && (
              <>
                <dt className="text-stone-500">Kontakt w rejestrze</dt>
                <dd className="text-stone-800">{[dane.email, dane.telefon, dane.www].filter(Boolean).join(" · ")}</dd>
              </>
            )}
          </dl>

          {pozostalePkd.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-stone-500">
                Pozostałe PKD ({pozostalePkd.length})
              </summary>
              <ul className="mt-1 space-y-0.5 text-stone-700">
                {pozostalePkd.map((p) => (
                  <li key={p.kod}>
                    {p.kod} — {p.nazwa}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            onClick={() => setUzupelnione(onZastosuj(dane))}
            className="przycisk-glowny mt-3 text-sm"
          >
            Uzupełnij dane z REGON
          </button>
          {uzupelnione && (
            <p className="mt-2 text-xs text-green-700">
              {uzupelnione.length > 0 ? `Uzupełniono: ${uzupelnione.join(", ")}.` : "Nie było czego uzupełnić."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
