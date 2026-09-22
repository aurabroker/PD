"use client";

import { useFormContext } from "react-hook-form";
import type { Lokalizacja, Wniosek } from "@/lib/schema";
import { sumaLokalizacji } from "@/lib/schema";
import { Pole, PoleKwota, PoleTakNie, PoleWybor, zl } from "@/components/pola";
import {
  ALARM_TYP,
  MATERIAL_SCIAN,
  OGRZEWANIE,
  POKRYCIE_DACHU,
  POZYCJE_SUM,
  SEJF_KLASA,
  STAN_TECHNICZNY,
  TYP_LOKALU,
} from "@/lib/slowniki";

/** Sekcje 2, 4A, 4B i sumy ubezpieczenia dla jednej lokalizacji. */
export default function KrokLokalizacja({ indeks }: { indeks: number }) {
  const { register, watch, formState } = useFormContext<Wniosek>();
  const lokalizacja = watch(`lokalizacje.${indeks}`);
  const bledy = formState.errors.lokalizacje?.[indeks];
  // Sciezka pola w formularzu. Generyk zachowuje literal, dzieki czemu react-hook-form
  // zna typ pola zamiast widziec zwykly string.
  const p = <K extends keyof Lokalizacja & string>(nazwa: K) =>
    `lokalizacje.${indeks}.${nazwa}` as `lokalizacje.${number}.${K}`;

  const suma = lokalizacja ? sumaLokalizacji(lokalizacja) : 0;

  // Kontrola spojnosci znana z arkusza: wykaz sprzetu kontra deklarowana suma.
  const sprzetMedyczny = watch("sprzet_medyczny") ?? [];
  const elektronika = watch("elektronika_eei") ?? [];
  const nr = lokalizacja?.nr ?? indeks + 1;

  const wykazMed = sprzetMedyczny
    .filter((u) => Number(u?.lokalizacja) === nr)
    .reduce((acc, u) => acc + (Number(u?.wartosc) || 0), 0);
  const wykazEei = elektronika
    .filter((u) => Number(u?.lokalizacja) === nr)
    .reduce((acc, u) => acc + (Number(u?.wartosc) || 0), 0);

  const deklarowanyMed = Number(lokalizacja?.suma_sprzet_medyczny) || 0;
  const deklarowanyEei = Number(lokalizacja?.suma_elektronika_it) || 0;

  return (
    <div className="space-y-6">
      <section className="karta">
        <h2 className="naglowek-sekcji">Sekcja 2 — lokalizacja i charakterystyka lokalu</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Nazwa lokalizacji" podpowiedz="np. Oddział Centrum"
            rejestracja={register(p("nazwa"))} />
          <Pole etykieta="Adres lokalizacji ubezpieczenia" wymagane
            blad={bledy?.adres} rejestracja={register(p("adres"))} />
          <PoleWybor etykieta="Typ lokalu" opcje={TYP_LOKALU} rejestracja={register(p("typ_lokalu"))} />
          <Pole etykieta="Piętro / kondygnacja" podpowiedz="np. 0, 1, -1"
            rejestracja={register(p("pietro"))} />
          <Pole etykieta="Powierzchnia (m²)" typ="number" rejestracja={register(p("powierzchnia"))} />
          <Pole etykieta="Rok budowy" rejestracja={register(p("rok_budowy"))} />
          <Pole etykieta="Rok ostatniego remontu" rejestracja={register(p("rok_remontu"))} />
          <PoleWybor etykieta="Materiał ścian" opcje={MATERIAL_SCIAN} rejestracja={register(p("material_scian"))} />
          <PoleWybor etykieta="Pokrycie dachu" opcje={POKRYCIE_DACHU} rejestracja={register(p("pokrycie_dachu"))} />
          <PoleWybor etykieta="Stan techniczny" opcje={STAN_TECHNICZNY} rejestracja={register(p("stan_techniczny"))} />
          <PoleWybor etykieta="Ogrzewanie" opcje={OGRZEWANIE} rejestracja={register(p("ogrzewanie"))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PoleTakNie etykieta="Budynek własny (nie najemca)" rejestracja={register(p("budynek_wlasny"))} />
          <PoleTakNie etykieta="Materiały palne w produkcji / procesie" rejestracja={register(p("materialy_palne"))} />
        </div>
      </section>

      <section className="karta">
        <h2 className="naglowek-sekcji">Sekcja 4A — zabezpieczenia przeciwpożarowe</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Pole etykieta="Gaśnice (liczba sztuk)" rejestracja={register(p("gasnice_szt"))} />
          <Pole etykieta="Data przeglądu gaśnic" podpowiedz="dd.mm.rrrr" rejestracja={register(p("data_przegladu_gasnic"))} />
          <Pole etykieta="Odległość od PSP (km)" rejestracja={register(p("odleglosc_psp"))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PoleTakNie etykieta="Hydranty wewnętrzne" rejestracja={register(p("hydranty"))} />
          <PoleTakNie etykieta="System alarmowania pożaru (SAP)" rejestracja={register(p("sap"))} />
          <PoleTakNie etykieta="Tryskacze / automatyczny system gaśniczy" rejestracja={register(p("tryskacze"))} />
          <PoleTakNie etykieta="Oznakowane drogi ewakuacyjne" rejestracja={register(p("drogi_ewakuacyjne"))} />
          <PoleTakNie etykieta="Zakaz palenia na obiekcie" rejestracja={register(p("zakaz_palenia"))} />
        </div>
      </section>

      <section className="karta">
        <h2 className="naglowek-sekcji">Sekcja 4B — zabezpieczenia antykradzieżowe</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <PoleWybor etykieta="Alarm — typ" opcje={ALARM_TYP} pustaEtykieta="brak"
            rejestracja={register(p("alarm_typ"))} />
          <Pole etykieta="Agencja ochrony (nazwa)" podpowiedz="np. Securitas, G4S"
            rejestracja={register(p("agencja_ochrony"))} />
          <PoleWybor etykieta="Sejf / szafa stalowa — klasa" opcje={SEJF_KLASA} pustaEtykieta="brak"
            rejestracja={register(p("sejf_klasa"))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PoleTakNie etykieta="Ogrodzenie terenu" rejestracja={register(p("ogrodzenie"))} />
          <PoleTakNie etykieta="Agencja ochrony czynna 24h" rejestracja={register(p("agencja_24h"))} />
          <PoleTakNie etykieta="Monitoring wizyjny (CCTV)" rejestracja={register(p("cctv"))} />
          <PoleTakNie etykieta="Kraty w oknach" rejestracja={register(p("kraty"))} />
          <PoleTakNie etykieta="Rolety antywłamaniowe" rejestracja={register(p("rolety"))} />
          <PoleTakNie etykieta="Zamki atestowane" rejestracja={register(p("zamki_atestowane"))} />
          <PoleTakNie etykieta="Drzwi atestowane (antywłamaniowe)" rejestracja={register(p("drzwi_atestowane"))} />
          <PoleTakNie etykieta="Szyby antywłamaniowe" rejestracja={register(p("szyby_antywlamaniowe"))} />
          <PoleTakNie etykieta="Komputerowy system alarmowy" rejestracja={register(p("system_alarmowy"))} />
        </div>
      </section>

      <section className="karta">
        <h2 className="naglowek-sekcji">Sumy ubezpieczenia dla tej lokalizacji</h2>
        <p className="mt-1.5 text-sm text-stone-600">
          Podaj wartość odtworzeniową — koszt zakupu nowego, w pełnych złotych.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {POZYCJE_SUM.map((pozycja) => (
            <PoleKwota
              key={pozycja.klucz}
              etykieta={pozycja.etykieta}
              rejestracja={register(p(pozycja.klucz))}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-marka-50 px-4 py-3">
          <span className="text-sm font-medium text-marka-900">Suma lokalizacji</span>
          <span className="text-lg font-semibold tabular-nums text-marka-900">{zl(suma)}</span>
        </div>

        {(deklarowanyMed > 0 || wykazMed > 0 || deklarowanyEei > 0 || wykazEei > 0) && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Kontrola spójności z wykazem sprzętu
            </p>
            <Kontrola
              nazwa="Sprzęt medyczny / estetyczny"
              wykaz={wykazMed}
              deklarowany={deklarowanyMed}
            />
            <Kontrola
              nazwa="Sprzęt elektroniczny (IT, kasy)"
              wykaz={wykazEei}
              deklarowany={deklarowanyEei}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Kontrola({ nazwa, wykaz, deklarowany }: { nazwa: string; wykaz: number; deklarowany: number }) {
  const zgodne = wykaz === deklarowany;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
        zgodne ? "bg-stone-50 text-stone-600" : "bg-amber-50 text-amber-900"
      }`}
    >
      <span>{nazwa}</span>
      <span className="tabular-nums">
        wykaz {zl(wykaz)} · deklarowane {zl(deklarowany)}
        {!zgodne && <span className="ml-2 font-medium">różnica {zl(Math.abs(wykaz - deklarowany))}</span>}
      </span>
    </div>
  );
}
