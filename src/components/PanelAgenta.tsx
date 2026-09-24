"use client";

import { useState, useTransition } from "react";
import {
  akcjaPrzedluzLink,
  akcjaPrzypiszAgenta,
  akcjaZapiszUwagiAgenta,
  akcjaZmienStatus,
} from "@/app/actions/panel";
import { POWODY_REZYGNACJI, STATUS, STATUS_ETYKIETY, type Status } from "@/lib/slowniki";
import { zl } from "@/lib/format";

type AgentOpcja = { user_id: string; nazwa: string };

type Props = {
  id: string;
  status: string;
  uwagiAgenta: string;
  linkKlienta: string;
  tokenWygasa: string | null;
  zrodlo: string;
  importPlik: string | null;
  /** Porownanie zaczytanego pliku z szablonem; null gdy nie bylo importu. */
  zgodnosc: { zgodny: boolean; roznice: string[]; liczba: number } | null;
  utworzony: string;
  wyslany: string | null;
  zakres: string[];
  zgody: { prawdziwosc: boolean; rodo: boolean };
  przypisanyAgent: string | null;
  agenci: AgentOpcja[];
  ja: { user_id: string; admin: boolean };
  oferta: {
    oferta_towarzystwo: string | null;
    oferta_skladka: number | null;
    polisa_numer: string | null;
    polisa_skladka: number | null;
    polisa_od: string | null;
    polisa_do: string | null;
    rezygnacja_powod: string | null;
  };
};

/** Boczny panel obsługi wniosku — przydział, status (z danymi oferty/polisy), notatka, link klienta. */
export default function PanelAgenta(props: Props) {
  const [status, setStatus] = useState<Status>(props.status as Status);
  const [nowy, setNowy] = useState<Status>(props.status as Status);
  const [pola, setPola] = useState({
    oferta_towarzystwo: props.oferta.oferta_towarzystwo ?? "",
    oferta_skladka: props.oferta.oferta_skladka?.toString() ?? "",
    polisa_numer: props.oferta.polisa_numer ?? "",
    polisa_skladka: props.oferta.polisa_skladka?.toString() ?? props.oferta.oferta_skladka?.toString() ?? "",
    polisa_od: props.oferta.polisa_od ?? "",
    polisa_do: props.oferta.polisa_do ?? "",
    rezygnacja_powod: props.oferta.rezygnacja_powod ?? "",
  });
  const [przypisany, setPrzypisany] = useState(props.przypisanyAgent);
  const [uwagi, setUwagi] = useState(props.uwagiAgenta);
  const [komunikat, setKomunikat] = useState<{ tekst: string; blad: boolean } | null>(null);
  const [oczekuje, startTransition] = useTransition();

  const pelnyLink =
    typeof window === "undefined" ? props.linkKlienta : `${window.location.origin}${props.linkKlienta}`;
  const wygasl = props.tokenWygasa ? new Date(props.tokenWygasa) < new Date() : false;

  const moj = przypisany === props.ja.user_id;
  const moznaEdytowac = props.ja.admin || !przypisany || moj;
  const nazwaPrzypisanego = props.agenci.find((a) => a.user_id === przypisany)?.nazwa;

  const pokaz = (w: { ok: boolean; komunikat?: string; blad?: string }) =>
    setKomunikat(w.ok ? { tekst: w.komunikat ?? "Zapisano.", blad: false } : { tekst: w.blad ?? "Błąd.", blad: true });

  function zapiszStatus() {
    const dane: Record<string, unknown> = { status: nowy };
    if (nowy === "wyceniony") Object.assign(dane, { oferta_towarzystwo: pola.oferta_towarzystwo, oferta_skladka: pola.oferta_skladka });
    if (nowy === "polisa")
      Object.assign(dane, {
        polisa_numer: pola.polisa_numer,
        polisa_skladka: pola.polisa_skladka,
        polisa_od: pola.polisa_od,
        polisa_do: pola.polisa_do,
      });
    if (nowy === "rezygnacja") dane.rezygnacja_powod = pola.rezygnacja_powod;

    startTransition(async () => {
      const w = await akcjaZmienStatus(props.id, dane).catch(() => ({ ok: false as const, blad: "Brak połączenia." }));
      pokaz(w);
      if (w.ok) {
        setStatus(nowy);
        if (!przypisany && !props.ja.admin) setPrzypisany(props.ja.user_id);
      }
    });
  }

  function przypisz(agentId: string | null) {
    startTransition(async () => {
      const w = await akcjaPrzypiszAgenta(props.id, agentId).catch(() => ({ ok: false as const, blad: "Brak połączenia." }));
      pokaz(w);
      if (w.ok) setPrzypisany(agentId);
    });
  }

  function zapiszUwagi() {
    startTransition(async () => pokaz(await akcjaZapiszUwagiAgenta(props.id, uwagi)));
  }

  function przedluz() {
    startTransition(async () => pokaz(await akcjaPrzedluzLink(props.id)));
  }

  const ustaw = (k: keyof typeof pola) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPola((p) => ({ ...p, [k]: e.target.value }));

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      {komunikat && (
        <p
          role="status"
          className={`rounded-lg px-4 py-2.5 text-xs ${komunikat.blad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
        >
          {komunikat.tekst}
        </p>
      )}

      {/* --- Przydział --- */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="etykieta">Prowadzi</p>
        <p className="text-sm font-medium text-stone-800" data-przypisany>
          {przypisany ? (moj ? "Ty" : nazwaPrzypisanego ?? "agent nieaktywny") : "nikt — wniosek w puli"}
        </p>
        {props.ja.admin ? (
          <select
            aria-label="Przypisz agenta"
            value={przypisany ?? ""}
            onChange={(e) => przypisz(e.target.value || null)}
            disabled={oczekuje}
            className="pole mt-3"
          >
            <option value="">— w puli (nieprzypisany) —</option>
            {props.agenci.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.user_id === props.ja.user_id ? `${a.nazwa} (Ty)` : a.nazwa}
              </option>
            ))}
          </select>
        ) : !przypisany ? (
          <button type="button" onClick={() => przypisz(props.ja.user_id)} disabled={oczekuje} className="przycisk-glowny mt-3 w-full">
            Przejmij wniosek
          </button>
        ) : moj ? (
          <button type="button" onClick={() => przypisz(null)} disabled={oczekuje} className="przycisk-drugi mt-3 w-full">
            Oddaj do puli
          </button>
        ) : (
          <p className="mt-2 text-xs text-stone-500">Wniosek prowadzi inny agent — zmiany może zrobić on albo administrator.</p>
        )}
      </div>

      {/* --- Status --- */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <label htmlFor="status" className="etykieta">Status wniosku</label>
        <p className="mb-2 text-sm text-stone-800">
          Teraz: <strong data-status-biezacy>{STATUS_ETYKIETY[status]}</strong>
        </p>
        <select
          id="status"
          value={nowy}
          onChange={(e) => setNowy(e.target.value as Status)}
          disabled={oczekuje || !moznaEdytowac}
          className="pole"
        >
          {STATUS.map((s) => (
            <option key={s} value={s}>{STATUS_ETYKIETY[s]}</option>
          ))}
        </select>

        {nowy === "wyceniony" && (
          <div className="mt-3 space-y-2">
            <input aria-label="Towarzystwo" placeholder="Towarzystwo (np. PZU)" value={pola.oferta_towarzystwo} onChange={ustaw("oferta_towarzystwo")} className="pole" />
            <input aria-label="Składka roczna oferty" placeholder="Składka roczna, zł" inputMode="decimal" value={pola.oferta_skladka} onChange={ustaw("oferta_skladka")} className="pole" />
          </div>
        )}
        {nowy === "polisa" && (
          <div className="mt-3 space-y-2">
            <input aria-label="Numer polisy" placeholder="Numer polisy" value={pola.polisa_numer} onChange={ustaw("polisa_numer")} className="pole" />
            <input aria-label="Składka roczna polisy" placeholder="Składka roczna, zł" inputMode="decimal" value={pola.polisa_skladka} onChange={ustaw("polisa_skladka")} className="pole" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-stone-500">Ochrona od
                <input aria-label="Ochrona od" type="date" value={pola.polisa_od} onChange={ustaw("polisa_od")} className="pole mt-1" />
              </label>
              <label className="text-xs text-stone-500">do
                <input aria-label="Ochrona do" type="date" value={pola.polisa_do} onChange={ustaw("polisa_do")} className="pole mt-1" />
              </label>
            </div>
          </div>
        )}
        {nowy === "rezygnacja" && (
          <select aria-label="Powód rezygnacji" value={pola.rezygnacja_powod} onChange={ustaw("rezygnacja_powod")} className="pole mt-3">
            <option value="">— powód rezygnacji —</option>
            {POWODY_REZYGNACJI.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        <button
          type="button"
          onClick={zapiszStatus}
          disabled={oczekuje || !moznaEdytowac || (nowy === status && !["wyceniony", "polisa", "rezygnacja"].includes(nowy))}
          className="przycisk-glowny mt-3 w-full"
        >
          {nowy === status ? "Zapisz dane" : `Zmień na: ${STATUS_ETYKIETY[nowy]}`}
        </button>

        {(props.oferta.oferta_skladka != null || props.oferta.polisa_numer) && (
          <dl className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs">
            {props.oferta.oferta_skladka != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-stone-400">Oferta</dt>
                <dd className="text-right text-stone-700">{props.oferta.oferta_towarzystwo} · {zl(Number(props.oferta.oferta_skladka))}</dd>
              </div>
            )}
            {props.oferta.polisa_numer && (
              <div className="flex justify-between gap-2">
                <dt className="text-stone-400">Polisa</dt>
                <dd className="text-right text-stone-700">
                  {props.oferta.polisa_numer} · {zl(Number(props.oferta.polisa_skladka))}
                  <br />
                  {props.oferta.polisa_od} – {props.oferta.polisa_do}
                </dd>
              </div>
            )}
            {status === "rezygnacja" && props.oferta.rezygnacja_powod && (
              <div className="flex justify-between gap-2">
                <dt className="text-stone-400">Powód</dt>
                <dd className="text-right text-stone-700">{props.oferta.rezygnacja_powod}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* --- Metryczka --- */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-stone-400">Źródło</dt>
            <dd className="text-stone-700">
              {props.zrodlo === "excel" ? "plik Excel" : props.zrodlo === "agent" ? "agent" : "formularz"}
            </dd>
          </div>
          {props.importPlik && (
            <div className="flex justify-between gap-2">
              <dt className="text-stone-400">Plik</dt>
              <dd className="truncate text-stone-700" title={props.importPlik}>{props.importPlik}</dd>
            </div>
          )}
          {props.zgodnosc && (
            <div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-400">Szablon</dt>
                <dd className={props.zgodnosc.zgodny ? "text-emerald-700" : "font-medium text-amber-700"}>
                  {props.zgodnosc.zgodny
                    ? "oryginalny"
                    : `zmieniony (${props.zgodnosc.liczba} ${props.zgodnosc.liczba === 1 ? "różnica" : "różnic"})`}
                </dd>
              </div>
              {!props.zgodnosc.zgodny && (
                <details className="mt-1 rounded bg-amber-50 p-2 text-amber-900">
                  <summary className="cursor-pointer">
                    Plik nie jest zgodny z naszym szablonem — sprawdź dane przed wysłaniem do TU
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {props.zgodnosc.roznice.map((r, i) => (
                      <li key={i} className="break-words">{r}</li>
                    ))}
                    {props.zgodnosc.liczba > props.zgodnosc.roznice.length && (
                      <li>… i {props.zgodnosc.liczba - props.zgodnosc.roznice.length} więcej</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-stone-400">Utworzony</dt>
            <dd className="text-stone-700">{new Date(props.utworzony).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}</dd>
          </div>
          {props.wyslany && (
            <div className="flex justify-between">
              <dt className="text-stone-400">Złożony</dt>
              <dd className="text-stone-700">{new Date(props.wyslany).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-stone-400">Oświadczenia</dt>
            <dd className={props.zgody.prawdziwosc && props.zgody.rodo ? "text-emerald-700" : "text-amber-700"}>
              {props.zgody.prawdziwosc && props.zgody.rodo ? "komplet" : "niepełne"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="etykieta">Zakres ubezpieczenia</p>
        {props.zakres.length === 0 ? (
          <p className="text-sm text-stone-400">nie zaznaczono</p>
        ) : (
          <ul className="space-y-1 text-sm text-stone-700">
            {props.zakres.map((z) => <li key={z}>· {z}</li>)}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <label htmlFor="uwagi" className="etykieta">Notatka agenta</label>
        <textarea
          id="uwagi"
          rows={5}
          value={uwagi}
          onChange={(e) => setUwagi(e.target.value)}
          placeholder="Widoczna tylko w panelu."
          className="pole resize-y"
          disabled={!moznaEdytowac}
        />
        <button type="button" onClick={zapiszUwagi} disabled={oczekuje || !moznaEdytowac} className="przycisk-drugi mt-3 w-full">
          Zapisz notatkę
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="etykieta">Link dla klienta</p>
        <input readOnly value={pelnyLink} className="pole text-xs" onFocus={(e) => e.target.select()} />
        <p className={`mt-2 text-xs ${wygasl ? "text-red-600" : "text-stone-500"}`}>
          {props.tokenWygasa
            ? wygasl
              ? "Link wygasł — klient nie otworzy wniosku."
              : `Ważny do ${new Date(props.tokenWygasa).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}`
            : "Bez daty wygaśnięcia"}
        </p>
        <button type="button" onClick={przedluz} disabled={oczekuje || !moznaEdytowac} className="przycisk-drugi mt-3 w-full">
          Przedłuż o 60 dni
        </button>
      </div>
    </aside>
  );
}
