"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { get, useFormContext } from "react-hook-form";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

/**
 * Blad pola odczytany z formularza po nazwie pola.
 *
 * Kazde pole samo znajduje swoj komunikat. Wczesniej trzeba bylo go przekazac
 * recznie przez `blad={...}` - i w sumach ubezpieczenia tego zabraklo, przez co
 * klient przy ujemnej kwocie widzial tylko "nie mozna zlozyc", bez wskazania pola.
 */
function useBladPola(nazwa: string, jawny?: { message?: string }) {
  const kontekst = useFormContext();
  if (jawny?.message) return jawny;
  if (!kontekst) return undefined;
  return get(kontekst.formState.errors, nazwa) as { message?: string } | undefined;
}

type Wspolne = {
  etykieta: string;
  podpowiedz?: string;
  wymagane?: boolean;
  blad?: FieldError | { message?: string };
  rejestracja: UseFormRegisterReturn;
};

function Opakowanie({
  etykieta,
  podpowiedz,
  wymagane,
  blad,
  id,
  children,
}: Omit<Wspolne, "rejestracja"> & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="etykieta">
        {etykieta}
        {wymagane && <span className="ml-0.5 text-marka-600">*</span>}
      </label>
      {children}
      {blad?.message ? (
        <p className="komunikat-bledu">{blad.message}</p>
      ) : podpowiedz ? (
        <p className="mt-1 text-xs text-stone-500">{podpowiedz}</p>
      ) : null}
    </div>
  );
}

export function Pole({
  etykieta,
  podpowiedz,
  wymagane,
  blad: jawny,
  rejestracja,
  typ = "text",
  atrybuty,
}: Wspolne & { typ?: string; atrybuty?: InputHTMLAttributes<HTMLInputElement> }) {
  const blad = useBladPola(rejestracja.name, jawny);
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <input
        id={rejestracja.name}
        type={typ}
        {...atrybuty}
        className={`pole ${blad?.message ? "pole-blad" : ""}`}
        aria-invalid={Boolean(blad?.message)}
        {...rejestracja}
      />
    </Opakowanie>
  );
}

export function PoleObszar({ etykieta, podpowiedz, wymagane, blad: jawny, rejestracja, wiersze = 4 }: Wspolne & { wiersze?: number }) {
  const blad = useBladPola(rejestracja.name, jawny);
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <textarea
        id={rejestracja.name}
        rows={wiersze}
        className={`pole resize-y ${blad?.message ? "pole-blad" : ""}`}
        {...rejestracja}
      />
    </Opakowanie>
  );
}

/** Pole kwotowe. W bazie i w Excelu kwoty sa w pelnych zlotych. */
/**
 * `tylkoOdczyt` — kwota wyliczana przez formularz (np. suma z wykazu sprzętu):
 * widoczna i zapisywana, ale nie do ręcznej edycji.
 */
export function PoleKwota({
  etykieta,
  podpowiedz,
  wymagane,
  blad: jawny,
  rejestracja,
  tylkoOdczyt = false,
}: Wspolne & { tylkoOdczyt?: boolean }) {
  const blad = useBladPola(rejestracja.name, jawny);
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <div className="relative">
        <input
          id={rejestracja.name}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          readOnly={tylkoOdczyt}
          aria-readonly={tylkoOdczyt || undefined}
          className={`pole pr-12 text-right tabular-nums ${blad?.message ? "pole-blad" : ""} ${
            tylkoOdczyt ? "cursor-default bg-marka-50 text-marka-900 focus:ring-0" : ""
          }`}
          {...rejestracja}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
          PLN
        </span>
      </div>
    </Opakowanie>
  );
}

export function PoleWybor({
  etykieta,
  podpowiedz,
  wymagane,
  blad: jawny,
  rejestracja,
  opcje,
  pustaEtykieta = "— wybierz —",
}: Wspolne & { opcje: readonly string[]; pustaEtykieta?: string }) {
  const blad = useBladPola(rejestracja.name, jawny);
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <select
        id={rejestracja.name}
        className={`pole ${blad?.message ? "pole-blad" : ""}`}
        {...rejestracja}
      >
        <option value="">{pustaEtykieta}</option>
        {opcje.map((opcja) => (
          <option key={opcja} value={opcja}>
            {opcja}
          </option>
        ))}
      </select>
    </Opakowanie>
  );
}

/** Odpowiednik pola TAK/NIE z arkusza. */
export function PoleTakNie({
  etykieta,
  podpowiedz,
  rejestracja,
}: {
  etykieta: string;
  podpowiedz?: string;
  rejestracja: UseFormRegisterReturn;
}) {
  const blad = useBladPola(rejestracja.name);
  return (
    <div>
    <label
      htmlFor={rejestracja.name}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 transition hover:border-marka-200 hover:bg-marka-50/40"
    >
      <input
        id={rejestracja.name}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-marka-700 focus:ring-marka-400"
        {...rejestracja}
      />
      <span className="text-sm text-stone-700">
        {etykieta}
        {podpowiedz && <span className="mt-0.5 block text-xs text-stone-500">{podpowiedz}</span>}
      </span>
    </label>
    {blad?.message && <p className="komunikat-bledu">{blad.message}</p>}
    </div>
  );
}

export function Sekcja({
  tytul,
  opis,
  children,
}: {
  tytul: string;
  opis?: string;
  children: ReactNode;
}) {
  return (
    <section className="karta">
      <h2 className="naglowek-sekcji">{tytul}</h2>
      {opis && <p className="mt-1.5 text-sm text-stone-600">{opis}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
