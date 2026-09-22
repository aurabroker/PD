"use client";

import { useState } from "react";
import { supabasePrzegladarka } from "@/lib/supabase/client";

/** Logowanie agenta. Magic link - bez hasel do zapamietywania i do wycieku. */
export default function StronaLogowania() {
  const [email, setEmail] = useState("");
  const [stan, setStan] = useState<"formularz" | "wysylam" | "wyslano">("formularz");
  const [blad, setBlad] = useState("");

  async function zaloguj(e: React.FormEvent) {
    e.preventDefault();
    setStan("wysylam");
    setBlad("");

    const supabase = supabasePrzegladarka();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?nastepnie=/admin` },
    });

    if (error) {
      setBlad(error.message);
      setStan("formularz");
      return;
    }

    setStan("wyslano");
  }

  if (stan === "wyslano") {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="karta">
          <h1 className="text-xl font-semibold">Sprawdź skrzynkę</h1>
          <p className="mt-3 text-sm text-stone-600">
            Wysłaliśmy link do logowania na adres <strong>{email}</strong>. Link jest jednorazowy
            i ważny przez godzinę.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={zaloguj} className="karta">
        <h1 className="text-xl font-semibold">Panel agenta</h1>
        <p className="mt-2 text-sm text-stone-600">
          Podaj swój służbowy adres e-mail — wyślemy link do logowania.
        </p>

        <div className="mt-6">
          <label htmlFor="email" className="etykieta">
            Adres e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pole"
          />
        </div>

        {blad && <p className="komunikat-bledu">{blad}</p>}

        <button type="submit" disabled={stan === "wysylam"} className="przycisk-glowny mt-5 w-full">
          {stan === "wysylam" ? "Wysyłam…" : "Wyślij link do logowania"}
        </button>
      </form>
    </main>
  );
}
