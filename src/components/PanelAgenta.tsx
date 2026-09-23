"use client";

import { useState, useTransition } from "react";
import { akcjaPrzedluzLink, akcjaZapiszUwagiAgenta, akcjaZmienStatus } from "@/app/actions/wniosek";
import { STATUS, STATUS_ETYKIETY } from "@/lib/slowniki";

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
};

/** Boczny panel obslugi wniosku - status, notatka agenta i link dla klienta. */
export default function PanelAgenta(props: Props) {
  const [status, setStatus] = useState(props.status);
  const [uwagi, setUwagi] = useState(props.uwagiAgenta);
  const [komunikat, setKomunikat] = useState("");
  const [oczekuje, startTransition] = useTransition();

  const pelnyLink =
    typeof window === "undefined" ? props.linkKlienta : `${window.location.origin}${props.linkKlienta}`;

  const wygasl = props.tokenWygasa ? new Date(props.tokenWygasa) < new Date() : false;

  function zmienStatus(nowy: string) {
    setStatus(nowy);
    startTransition(async () => {
      const wynik = await akcjaZmienStatus(props.id, nowy);
      setKomunikat(wynik.ok ? "Status zaktualizowany." : wynik.blad);
    });
  }

  function zapiszUwagi() {
    startTransition(async () => {
      const wynik = await akcjaZapiszUwagiAgenta(props.id, uwagi);
      setKomunikat(wynik.ok ? "Zapisano notatkę." : wynik.blad);
    });
  }

  function przedluz() {
    startTransition(async () => {
      const wynik = await akcjaPrzedluzLink(props.id);
      setKomunikat(wynik.ok ? "Link przedłużony o 60 dni." : wynik.blad);
    });
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <label htmlFor="status" className="etykieta">Status wniosku</label>
        <select
          id="status"
          value={status}
          onChange={(e) => zmienStatus(e.target.value)}
          disabled={oczekuje}
          className="pole"
        >
          {STATUS.map((s) => (
            <option key={s} value={s}>{STATUS_ETYKIETY[s]}</option>
          ))}
        </select>

        <dl className="mt-5 space-y-2 text-xs">
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
            <dd className="text-stone-700">
              {new Date(props.utworzony).toLocaleDateString("pl-PL")}
            </dd>
          </div>
          {props.wyslany && (
            <div className="flex justify-between">
              <dt className="text-stone-400">Złożony</dt>
              <dd className="text-stone-700">
                {new Date(props.wyslany).toLocaleDateString("pl-PL")}
              </dd>
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
        />
        <button type="button" onClick={zapiszUwagi} disabled={oczekuje} className="przycisk-drugi mt-3 w-full">
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
              : `Ważny do ${new Date(props.tokenWygasa).toLocaleDateString("pl-PL")}`
            : "Bez daty wygaśnięcia"}
        </p>
        <button type="button" onClick={przedluz} disabled={oczekuje} className="przycisk-drugi mt-3 w-full">
          Przedłuż o 60 dni
        </button>
      </div>

      {komunikat && <p className="rounded-lg bg-stone-100 px-4 py-2.5 text-xs text-stone-700">{komunikat}</p>}
    </aside>
  );
}
