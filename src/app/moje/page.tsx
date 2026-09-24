"use client";

import { useCallback, useEffect, useState } from "react";
import { akcjaMojeWnioski } from "@/app/actions/wniosek";
import { supabasePrzegladarka } from "@/lib/supabase/client";
import { STATUS_ETYKIETY } from "@/lib/slowniki";
import Turnstile from "@/components/Turnstile";
import { TURNSTILE_WLACZONY } from "@/lib/turnstile-config";

type Pozycja = Awaited<ReturnType<typeof akcjaMojeWnioski>>[number];

/** Klient loguje sie magic linkiem i widzi wnioski zlozone na swoj adres e-mail. */
export default function StronaMojeWnioski() {
  const [email, setEmail] = useState("");
  const [stan, setStan] = useState<"sprawdzam" | "formularz" | "wyslano" | "lista">("sprawdzam");
  const [wnioski, setWnioski] = useState<Pozycja[]>([]);
  const [blad, setBlad] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const onToken = useCallback((t: string) => setToken(t), []);

  useEffect(() => {
    const supabase = supabasePrzegladarka();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user?.email) {
        setStan("formularz");
        return;
      }
      setEmail(data.user.email);
      setWnioski(await akcjaMojeWnioski());
      setStan("lista");
    });
  }, []);

  async function wyslijLink(e: React.FormEvent) {
    e.preventDefault();
    setBlad("");

    const supabase = supabasePrzegladarka();

    // Adres powrotu musi byc na liscie Redirect URLs w Supabase (Authentication ->
    // URL Configuration). Gdy go tam nie ma, Supabase po cichu podstawia Site URL
    // projektu i klient laduje na zupelnie innej domenie.
    const adresPowrotu = `${
      process.env.NEXT_PUBLIC_ADRES_APLIKACJI || window.location.origin
    }/auth/callback?nastepnie=/moje`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: adresPowrotu, ...(token ? { captchaToken: token } : {}) },
    });

    if (error) {
      // Token Turnstile jest jednorazowy — po bledzie odswiezamy widget.
      setToken("");
      setResetKey((k) => k + 1);
      setBlad(error.message);
      return;
    }
    setStan("wyslano");
  }

  if (stan === "sprawdzam") {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-sm text-stone-500">Ładuję…</main>;
  }

  if (stan === "wyslano") {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="karta">
          <h1 className="text-xl font-semibold">Sprawdź skrzynkę</h1>
          <p className="mt-3 text-sm text-stone-600">
            Link do Twoich wniosków poszedł na <strong>{email}</strong>.
          </p>
        </div>
      </main>
    );
  }

  if (stan === "formularz") {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <form onSubmit={wyslijLink} className="karta">
          <h1 className="text-xl font-semibold">Moje wnioski</h1>
          <p className="mt-2 text-sm text-stone-600">
            Podaj adres e-mail użyty we wniosku — wyślemy link bez zakładania konta.
          </p>
          <div className="mt-6">
            <label htmlFor="email" className="etykieta">Adres e-mail</label>
            <input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="pole" />
          </div>
          <Turnstile key={resetKey} onToken={onToken} />
          {blad && <p className="komunikat-bledu">{blad}</p>}
          <button
            type="submit"
            disabled={TURNSTILE_WLACZONY && !token}
            className="przycisk-glowny mt-5 w-full"
          >
            Wyślij link
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Moje wnioski</h1>
      <p className="mt-1 text-sm text-stone-500">{email}</p>

      {wnioski.length === 0 ? (
        <p className="karta mt-6 text-sm text-stone-600">
          Nie znaleźliśmy wniosków na ten adres.{" "}
          <a href="/" className="text-marka-700 underline">Rozpocznij nowy</a>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {wnioski.map((w) => (
            <li key={w.id} className="karta flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{w.nr_referencyjny}</p>
                <p className="text-sm text-stone-600">{w.nazwa_firmy}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {STATUS_ETYKIETY[w.status as keyof typeof STATUS_ETYKIETY] ?? w.status} · zmieniony{" "}
                  {new Date(w.updated_at).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}
                </p>
              </div>
              <div className="flex gap-2">
                {w.status === "roboczy" && (
                  <a href={`/wniosek/${w.form_token}`} className="przycisk-glowny">Dokończ</a>
                )}
                <a href={`/api/wniosek/${w.form_token}/excel`} className="przycisk-drugi">.xlsx</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
