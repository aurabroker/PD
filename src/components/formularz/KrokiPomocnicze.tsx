"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import type { Wniosek } from "@/lib/schema";
import { Pole, PoleKwota, PoleTakNie } from "@/components/pola";
import { zl } from "@/lib/format";

/** Wspolna tabela wykazu sprzetu - rozni sie tylko kolumnami. */
function PrzyciskDodaj({ onClick, etykieta }: { onClick: () => void; etykieta: string }) {
  return (
    <button type="button" onClick={onClick} className="przycisk-drugi mt-4">
      + {etykieta}
    </button>
  );
}

function PrzyciskUsun({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-stone-400 transition hover:text-red-600"
      aria-label="Usuń pozycję"
    >
      Usuń
    </button>
  );
}

export function WykazSprzetuMedycznego({ liczbaLokalizacji }: { liczbaLokalizacji: number }) {
  const { register, control, watch, formState } = useFormContext<Wniosek>();
  const { fields, append, remove } = useFieldArray({ control, name: "sprzet_medyczny" });
  const pozycje = watch("sprzet_medyczny") ?? [];
  const suma = pozycje.reduce((acc, p) => acc + (Number(p?.wartosc) || 0), 0);

  return (
    <div>
      {fields.length === 0 && (
        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
          Brak urządzeń na liście. Dodaj sprzęt medyczny i estetyczny, który ma być objęty ochroną.
        </p>
      )}

      <div className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id} className="rounded-lg border border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Urządzenie {i + 1}</span>
              <PrzyciskUsun onClick={() => remove(i)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="etykieta">Lokalizacja</label>
                <select className="pole" {...register(`sprzet_medyczny.${i}.lokalizacja`)}>
                  {Array.from({ length: liczbaLokalizacji }, (_, n) => n + 1).map((nr) => (
                    <option key={nr} value={nr}>
                      Lokalizacja {nr}
                    </option>
                  ))}
                </select>
              </div>
              <Pole etykieta="Nazwa urządzenia" rejestracja={register(`sprzet_medyczny.${i}.nazwa`)}
                blad={formState.errors.sprzet_medyczny?.[i]?.nazwa} />
              <Pole etykieta="Producent" rejestracja={register(`sprzet_medyczny.${i}.producent`)} />
              <Pole etykieta="Model" rejestracja={register(`sprzet_medyczny.${i}.model`)} />
              <Pole etykieta="Nr seryjny" rejestracja={register(`sprzet_medyczny.${i}.nr_seryjny`)} />
              <Pole etykieta="Rok zakupu" rejestracja={register(`sprzet_medyczny.${i}.rok_zakupu`)} />
              <PoleKwota etykieta="Wartość odtworzeniowa" rejestracja={register(`sprzet_medyczny.${i}.wartosc`)} />
              <div className="sm:col-span-2 lg:col-span-2">
                <Pole etykieta="Uwagi" rejestracja={register(`sprzet_medyczny.${i}.uwagi`)} />
              </div>
              <div className="lg:col-span-3">
                <PoleTakNie etykieta="Urządzenie ma certyfikat CE"
                  rejestracja={register(`sprzet_medyczny.${i}.cert_ce`)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <PrzyciskDodaj etykieta="Dodaj urządzenie" onClick={() => append({
          lokalizacja: 1, nazwa: "", producent: "", model: "", nr_seryjny: "",
          rok_zakupu: "", wartosc: 0, cert_ce: false, uwagi: "",
        })} />
        <p className="text-sm text-stone-600">
          Razem: <span className="font-medium tabular-nums text-stone-900">{zl(suma)}</span>
        </p>
      </div>
    </div>
  );
}

export function WykazElektroniki({ liczbaLokalizacji }: { liczbaLokalizacji: number }) {
  const { register, control, watch } = useFormContext<Wniosek>();
  const { fields, append, remove } = useFieldArray({ control, name: "elektronika_eei" });
  const pozycje = watch("elektronika_eei") ?? [];
  const suma = pozycje.reduce((acc, p) => acc + (Number(p?.wartosc) || 0), 0);

  return (
    <div>
      {fields.length === 0 && (
        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
          Brak sprzętu na liście. Wpisz komputery, kasy fiskalne, terminale płatnicze i sprzęt IT.
        </p>
      )}

      <div className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id} className="rounded-lg border border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Sprzęt {i + 1}</span>
              <PrzyciskUsun onClick={() => remove(i)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="etykieta">Lokalizacja</label>
                <select className="pole" {...register(`elektronika_eei.${i}.lokalizacja`)}>
                  {Array.from({ length: liczbaLokalizacji }, (_, n) => n + 1).map((nr) => (
                    <option key={nr} value={nr}>Lokalizacja {nr}</option>
                  ))}
                </select>
              </div>
              <Pole etykieta="Nazwa urządzenia" rejestracja={register(`elektronika_eei.${i}.nazwa`)} />
              <Pole etykieta="Producent" rejestracja={register(`elektronika_eei.${i}.producent`)} />
              <Pole etykieta="Model" rejestracja={register(`elektronika_eei.${i}.model`)} />
              <Pole etykieta="Rok zakupu" rejestracja={register(`elektronika_eei.${i}.rok_zakupu`)} />
              <PoleKwota etykieta="Wartość odtworzeniowa" rejestracja={register(`elektronika_eei.${i}.wartosc`)} />
              <Pole etykieta="Nr seryjny" rejestracja={register(`elektronika_eei.${i}.nr_seryjny`)} />
              <div className="sm:col-span-2">
                <Pole etykieta="Uwagi" rejestracja={register(`elektronika_eei.${i}.uwagi`)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <PrzyciskDodaj etykieta="Dodaj sprzęt" onClick={() => append({
          lokalizacja: 1, nazwa: "", producent: "", model: "", rok_zakupu: "",
          wartosc: 0, nr_seryjny: "", uwagi: "",
        })} />
        <p className="text-sm text-stone-600">
          Razem: <span className="font-medium tabular-nums text-stone-900">{zl(suma)}</span>
        </p>
      </div>
    </div>
  );
}

export function TabelaSzkod() {
  const { register, control, watch } = useFormContext<Wniosek>();
  const { fields, append, remove } = useFieldArray({ control, name: "szkody" });
  const brakSzkod = watch("brak_szkod");

  return (
    <div>
      <PoleTakNie
        etykieta="W ostatnich 5 latach nie wystąpiły żadne szkody"
        podpowiedz="Odznacz, jeśli szkody wystąpiły — wtedy uzupełnij tabelę poniżej."
        rejestracja={register("brak_szkod")}
      />

      {!brakSzkod && (
        <div className="mt-6">
          <div className="space-y-4">
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-stone-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500">Szkoda {i + 1}</span>
                  <PrzyciskUsun onClick={() => remove(i)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Pole etykieta="Data szkody" podpowiedz="dd.mm.rrrr" rejestracja={register(`szkody.${i}.data`)} />
                  <Pole etykieta="Przyczyna" rejestracja={register(`szkody.${i}.przyczyna`)} />
                  <Pole etykieta="Ubezpieczyciel" rejestracja={register(`szkody.${i}.ubezpieczyciel`)} />
                  <PoleKwota etykieta="Kwota szkody" rejestracja={register(`szkody.${i}.kwota_szkody`)} />
                  <PoleKwota etykieta="Wypłacone odszkodowanie" rejestracja={register(`szkody.${i}.odszkodowanie`)} />
                </div>
              </div>
            ))}
          </div>

          {fields.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              Zaznaczono, że szkody wystąpiły — dodaj co najmniej jedną pozycję.
            </p>
          )}

          <PrzyciskDodaj etykieta="Dodaj szkodę" onClick={() => append({
            data: "", przyczyna: "", kwota_szkody: 0, odszkodowanie: 0, ubezpieczyciel: "",
          })} />
        </div>
      )}
    </div>
  );
}
