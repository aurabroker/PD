"use client";

import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

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

export function Pole({ etykieta, podpowiedz, wymagane, blad, rejestracja, typ = "text" }: Wspolne & { typ?: string }) {
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <input
        id={rejestracja.name}
        type={typ}
        className={`pole ${blad?.message ? "pole-blad" : ""}`}
        aria-invalid={Boolean(blad?.message)}
        {...rejestracja}
      />
    </Opakowanie>
  );
}

export function PoleObszar({ etykieta, podpowiedz, wymagane, blad, rejestracja, wiersze = 4 }: Wspolne & { wiersze?: number }) {
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
export function PoleKwota({ etykieta, podpowiedz, wymagane, blad, rejestracja }: Wspolne) {
  return (
    <Opakowanie id={rejestracja.name} {...{ etykieta, podpowiedz, wymagane, blad }}>
      <div className="relative">
        <input
          id={rejestracja.name}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={`pole pr-12 text-right tabular-nums ${blad?.message ? "pole-blad" : ""}`}
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
  blad,
  rejestracja,
  opcje,
  pustaEtykieta = "— wybierz —",
}: Wspolne & { opcje: readonly string[]; pustaEtykieta?: string }) {
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
  return (
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
