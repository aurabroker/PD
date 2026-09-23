"use client";

import { useState, useTransition } from "react";
import { akcjaWeryfikujRegon } from "@/app/actions/wniosek";
import type { DaneRegon } from "@/lib/regon";

/**
 * Weryfikacja firmy po NIP w bazie REGON. Pobiera oficjalne dane (nazwa, adres,
 * REGON, status) i pozwala jednym kliknięciem uzupełnić nimi formularz.
 */
export default function WeryfikacjaRegon({
  pobierzNip,
  onZastosuj,
}: {
  pobierzNip: () => string;
  onZastosuj: (dane: DaneRegon) => void;
}) {
  const [oczekuje, start] = useTransition();
  const [dane, setDane] = useState<DaneRegon | null>(null);
  const [blad, setBlad] = useState("");
  const [zastosowano, setZastosowano] = useState(false);

  function sprawdz() {
    setBlad("");
    setDane(null);
    setZastosowano(false);
    start(async () => {
      const wynik = await akcjaWeryfikujRegon(pobierzNip());
      if (!wynik.ok) {
        setBlad(wynik.blad);
        return;
      }
      setDane(wynik.dane);
    });
  }

  return (
    <div className="sm:col-span-2">
      <button
        type="button"
        onClick={sprawdz}
        disabled={oczekuje}
        className="przycisk-drugi text-sm"
      >
        {oczekuje ? "Sprawdzam w REGON…" : "Sprawdź firmę w REGON"}
      </button>

      {blad && <p className="mt-2 text-xs text-red-600">{blad}</p>}

      {dane && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          {dane.test && (
            <p className="mb-2 text-xs font-medium text-amber-700">
              Rejestr testowy GUS — dane nie są prawdziwe (brak klucza produkcyjnego).
            </p>
          )}
          <p className="font-medium text-stone-900">{dane.nazwa || "—"}</p>
          {dane.adres && <p className="text-stone-600">{dane.adres}</p>}
          <p className="mt-1 text-xs text-stone-500">
            REGON: {dane.regon || "—"}
            {" · "}
            {dane.aktywna ? (
              <span className="text-green-700">działalność aktywna</span>
            ) : (
              <span className="text-red-600">
                działalność zakończona{dane.data_zakonczenia ? ` (${dane.data_zakonczenia})` : ""}
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={() => {
              onZastosuj(dane);
              setZastosowano(true);
            }}
            className="przycisk-glowny mt-3 text-sm"
          >
            Uzupełnij dane z REGON
          </button>
          {zastosowano && (
            <span className="ml-3 text-xs text-green-700">Uzupełniono nazwę, adres i REGON.</span>
          )}
        </div>
      )}
    </div>
  );
}
