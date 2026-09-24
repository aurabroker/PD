"use client";

import { useState, useTransition } from "react";
import {
  akcjaDodajAgenta,
  akcjaNowyLinkHasla,
  akcjaUstawAktywnosc,
  akcjaZmienRole,
  type WynikAgenta,
} from "@/app/actions/agenci";
import { akcjaPrzypiszAgenta } from "@/app/actions/panel";

type Komunikat = { tekst: string; blad: boolean; link?: string } | null;

function PokazKomunikat({ k }: { k: Komunikat }) {
  if (!k) return null;
  return (
    <div role="status" className={`mt-3 rounded-lg px-4 py-3 text-sm ${k.blad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-900"}`}>
      <p>{k.tekst}</p>
      {k.link && (
        <div className="mt-2">
          <p className="text-xs text-stone-600">Link do ustawienia hasła (jednorazowy):</p>
          <input readOnly value={k.link} onFocus={(e) => e.target.select()} className="pole mt-1 text-xs" data-link-hasla />
        </div>
      )}
    </div>
  );
}

const naKomunikat = (w: WynikAgenta): Komunikat =>
  w.ok ? { tekst: w.komunikat, blad: false, link: w.link } : { tekst: w.blad, blad: true };

export function FormularzAgenta() {
  const [email, setEmail] = useState("");
  const [imie, setImie] = useState("");
  const [rola, setRola] = useState("agent");
  const [k, setK] = useState<Komunikat>(null);
  const [oczekuje, start] = useTransition();

  function dodaj(e: React.FormEvent) {
    e.preventDefault();
    setK(null);
    start(async () => {
      const w = await akcjaDodajAgenta({ email, imie_nazwisko: imie, rola }).catch(() => ({ ok: false as const, blad: "Brak połączenia." }));
      setK(naKomunikat(w));
      if (w.ok) {
        setEmail("");
        setImie("");
        setRola("agent");
      }
    });
  }

  return (
    <form onSubmit={dodaj} className="rounded-xl border border-stone-200 bg-white p-5" aria-label="Dodaj agenta">
      <h2 className="text-sm font-semibold">Dodaj agenta</h2>
      <p className="mt-0.5 text-xs text-stone-500">
        Agent dostanie e-mail z linkiem do ustawienia hasła. Link pokażemy też tutaj — na wypadek, gdyby mail nie dotarł.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
        <input aria-label="Imię i nazwisko" placeholder="Imię i nazwisko" required value={imie} onChange={(e) => setImie(e.target.value)} className="pole" />
        <input aria-label="E-mail" type="email" placeholder="E-mail służbowy" required value={email} onChange={(e) => setEmail(e.target.value)} className="pole" />
        <select aria-label="Rola" value={rola} onChange={(e) => setRola(e.target.value)} className="pole">
          <option value="agent">Agent</option>
          <option value="admin">Administrator</option>
        </select>
        <button type="submit" disabled={oczekuje} className="przycisk-glowny">{oczekuje ? "Dodaję…" : "Dodaj"}</button>
      </div>
      <PokazKomunikat k={k} />
    </form>
  );
}

export function AkcjeAgenta({ userId, rola, aktywny, ja }: { userId: string; rola: string; aktywny: boolean; ja: boolean }) {
  const [k, setK] = useState<Komunikat>(null);
  const [oczekuje, start] = useTransition();
  const uruchom = (fn: () => Promise<WynikAgenta>) =>
    start(async () => setK(naKomunikat(await fn().catch(() => ({ ok: false as const, blad: "Brak połączenia." })))));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <select
          aria-label="Rola agenta"
          defaultValue={rola}
          disabled={oczekuje || ja}
          onChange={(e) => uruchom(() => akcjaZmienRole(userId, e.target.value))}
          className="rounded-md border border-stone-300 px-2 py-1 text-xs"
        >
          <option value="agent">agent</option>
          <option value="admin">administrator</option>
        </select>
        {aktywny && (
          <button type="button" disabled={oczekuje} onClick={() => uruchom(() => akcjaNowyLinkHasla(userId))} className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50">
            Nowy link do hasła
          </button>
        )}
        {!ja && (
          <button
            type="button"
            disabled={oczekuje}
            onClick={() => {
              if (aktywny && !confirm("Dezaktywować agenta? Straci dostęp od razu, a jego otwarte wnioski wrócą do puli.")) return;
              uruchom(() => akcjaUstawAktywnosc(userId, !aktywny));
            }}
            className={`rounded-md border px-2 py-1 text-xs ${aktywny ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"}`}
          >
            {aktywny ? "Dezaktywuj" : "Aktywuj"}
          </button>
        )}
      </div>
      <PokazKomunikat k={k} />
    </div>
  );
}

export function SzybkiPrzydzial({ wniosekId, agenci }: { wniosekId: string; agenci: { user_id: string; nazwa: string }[] }) {
  const [k, setK] = useState<Komunikat>(null);
  const [oczekuje, start] = useTransition();
  return (
    <div>
      <select
        aria-label="Przydziel"
        defaultValue=""
        disabled={oczekuje}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          start(async () => {
            const w = await akcjaPrzypiszAgenta(wniosekId, id).catch(() => ({ ok: false as const, blad: "Brak połączenia." }));
            setK(w.ok ? { tekst: w.komunikat, blad: false } : { tekst: w.blad, blad: true });
          });
        }}
        className="rounded-md border border-stone-300 px-2 py-1 text-xs"
      >
        <option value="">— przydziel —</option>
        {agenci.map((a) => <option key={a.user_id} value={a.user_id}>{a.nazwa}</option>)}
      </select>
      {k && <span className={`ml-2 text-xs ${k.blad ? "text-red-700" : "text-emerald-700"}`}>{k.tekst}</span>}
    </div>
  );
}
