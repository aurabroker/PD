"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabasePrzegladarka } from "@/lib/supabase/client";

/**
 * Logowanie agenta: e-mail i haslo.
 *
 * Swiadomie bez magic linku - logowanie mailem wymaga przekierowania przez
 * Supabase, a to zalezy od listy Redirect URLs w projekcie. Haslo dziala
 * niezaleznie od domeny, pod ktora stoi aplikacja.
 *
 * Samo zalogowanie nie daje jeszcze dostepu do panelu: `biezacyAdmin()`
 * dodatkowo sprawdza wpis w `katalog_admins`.
 */
export default function StronaLogowania() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [oczekuje, setOczekuje] = useState(false);
  const [blad, setBlad] = useState("");

  async function zaloguj(e: React.FormEvent) {
    e.preventDefault();
    setOczekuje(true);
    setBlad("");

    const supabase = supabasePrzegladarka();
    const { error } = await supabase.auth.signInWithPassword({ email, password: haslo });

    if (error) {
      // Komunikaty Supabase sa po angielsku - tlumaczymy te, ktore realnie wystepuja.
      const komunikaty: Record<string, string> = {
        "Invalid login credentials": "Nieprawidłowy e-mail lub hasło.",
        "Email not confirmed": "Adres e-mail nie został jeszcze potwierdzony.",
      };
      setBlad(komunikaty[error.message] ?? error.message);
      setOczekuje(false);
      return;
    }

    // refresh() wymusza ponowne wykonanie server componentow ze swiezym ciasteczkiem sesji.
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={zaloguj} className="karta">
        <h1 className="text-xl font-semibold">Panel agenta</h1>
        <p className="mt-2 text-sm text-stone-600">
          Zaloguj się służbowym adresem e-mail i hasłem.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="etykieta">
              Adres e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pole"
            />
          </div>

          <div>
            <label htmlFor="haslo" className="etykieta">
              Hasło
            </label>
            <input
              id="haslo"
              type="password"
              required
              autoComplete="current-password"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              className="pole"
            />
          </div>
        </div>

        {blad && <p className="komunikat-bledu mt-3">{blad}</p>}

        <button type="submit" disabled={oczekuje} className="przycisk-glowny mt-5 w-full">
          {oczekuje ? "Loguję…" : "Zaloguj się"}
        </button>

        <p className="mt-4 text-xs text-stone-500">
          Hasło nadaje administrator w panelu Supabase. Jeśli go nie pamiętasz — zgłoś się po
          zresetowanie.
        </p>
      </form>
    </main>
  );
}
