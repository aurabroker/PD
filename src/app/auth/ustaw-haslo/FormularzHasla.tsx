"use client";

import { useState, useTransition } from "react";
import { akcjaUstawHaslo } from "@/app/actions/haslo";

export default function FormularzHasla({ tokenHash, typ }: { tokenHash: string; typ: string }) {
  const [haslo, setHaslo] = useState("");
  const [powtorz, setPowtorz] = useState("");
  const [blad, setBlad] = useState("");
  const [oczekuje, start] = useTransition();

  function zapisz(e: React.FormEvent) {
    e.preventDefault();
    setBlad("");
    start(async () => {
      try {
        const wynik = await akcjaUstawHaslo({ tokenHash, typ, haslo, powtorz });
        if (wynik?.blad) setBlad(wynik.blad);
      } catch (e) {
        // redirect() z akcji rzuca NEXT_REDIRECT — to sukces, nie blad.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        setBlad("Nie udało się połączyć. Spróbuj ponownie.");
      }
    });
  }

  return (
    <form onSubmit={zapisz} className="mt-6 space-y-4">
      <div>
        <label htmlFor="haslo" className="etykieta">Nowe hasło</label>
        <input id="haslo" type="password" autoComplete="new-password" required minLength={10}
          value={haslo} onChange={(e) => setHaslo(e.target.value)} className="pole" />
      </div>
      <div>
        <label htmlFor="powtorz" className="etykieta">Powtórz hasło</label>
        <input id="powtorz" type="password" autoComplete="new-password" required minLength={10}
          value={powtorz} onChange={(e) => setPowtorz(e.target.value)} className="pole" />
      </div>
      {blad && <p className="komunikat-bledu">{blad}</p>}
      <button type="submit" disabled={oczekuje} className="przycisk-glowny w-full">
        {oczekuje ? "Zapisuję…" : "Ustaw hasło"}
      </button>
    </form>
  );
}
