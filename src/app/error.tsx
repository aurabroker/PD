"use client";

import { useEffect } from "react";

/**
 * Granica bledu dla stron. Produkcyjny build Next.js ukrywa tresc bledu
 * i zostawia sam `digest` - bez tego ekranu uzytkownik widzi wylacznie
 * komunikat systemowy, a my nie wiemy nawet, gdzie szukac.
 */
export default function Blad({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[granica bledu]", error.digest, error.message);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="karta">
        <h1 className="text-xl font-semibold">Coś poszło nie tak</h1>
        <p className="mt-3 text-sm text-stone-600">
          Nie udało się wczytać tej strony. Twoje dane są bezpieczne — nic nie zostało utracone.
        </p>

        {error.digest && (
          <p className="mt-4 rounded-lg bg-stone-50 p-3 font-mono text-xs text-stone-600">
            Kod błędu: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="przycisk-glowny">
            Spróbuj ponownie
          </button>
          <a href="/" className="przycisk-drugi">
            Wróć na stronę główną
          </a>
        </div>

        <p className="mt-6 text-xs text-stone-500">
          Jeśli to się powtarza, sprawdź <a href="/api/stan" className="underline">/api/stan</a> —
          pokazuje, czy aplikacja ma komplet konfiguracji i połączenie z bazą.
        </p>
      </div>
    </main>
  );
}
