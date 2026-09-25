"use client";

/**
 * Ostatnia linia obrony - lapie bledy powstale w samym layoucie glownym,
 * gdzie `error.tsx` juz nie dziala. Musi renderowac wlasne <html> i <body>.
 */
export default function BladGlobalny({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", maxWidth: "36rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Aplikacja napotkała błąd</h1>
        <p style={{ marginTop: "0.75rem", color: "#57534e", fontSize: "0.875rem" }}>
          Spróbuj odświeżyć stronę. Jeśli problem się utrzymuje, podaj poniższy kod przy zgłoszeniu.
        </p>
        {error.digest && (
          <p style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "0.75rem", background: "#f5f5f4", padding: "0.75rem", borderRadius: "0.5rem" }}>
            Kod błędu: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: 0, background: "#00769f", color: "white", fontSize: "0.875rem", cursor: "pointer" }}
        >
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
