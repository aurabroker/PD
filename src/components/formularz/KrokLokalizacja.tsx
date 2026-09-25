"use client";

import { useFormContext } from "react-hook-form";
import type { Lokalizacja, Wniosek } from "@/lib/schema";
import { sumaLokalizacji } from "@/lib/schema";
import { Pole, PoleKwota, PoleTakNie, PoleWybor } from "@/components/pola";
import { zl } from "@/lib/format";
import {
  ALARM_TYP,
  MATERIAL_SCIAN,
  OGRZEWANIE,
  PIETRO,
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

  // Sumy sprzętu z wykazu liczy formularz (KreatorWniosku) — tu tylko pokazujemy skąd są.
  const zWykazu: Partial<Record<(typeof POZYCJE_SUM)[number]["klucz"], string>> = {
    ...(wykazMed > 0 && { suma_sprzet_medyczny: "Wyliczone z wykazu w kroku „Sprzęt medyczny”" }),
    ...(wykazEei > 0 && { suma_elektronika_it: "Wyliczone z wykazu w kroku „Elektronika”" }),
  };
  const rokTeraz = new Date().getFullYear();
  const rok = { inputMode: "numeric" as const, min: 1800, max: rokTeraz, placeholder: "np. 1998" };

  return (
    <div className="space-y-6">
      <section className="karta">
        <h2 className="naglowek-sekcji">Sekcja 2 — lokalizacja i charakterystyka lokalu</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Nazwa lokalizacji" podpowiedz="np. Oddział Centrum"
            rejestracja={register(p("nazwa"))} />
          <Pole etykieta="Adres lokalizacji ubezpieczenia" wymagane
            blad={bledy?.adres} rejestracja={register(p("adres"))} />
          <PoleWybor etykieta="Typ lokalu" wymagane opcje={TYP_LOKALU} rejestracja={register(p("typ_lokalu"))} />
          <PoleWybor etykieta="Piętro / kondygnacja" wymagane opcje={PIETRO} rejestracja={register(p("pietro"))} />
          <Pole etykieta="Powierzchnia (m²)" wymagane typ="number" rejestracja={register(p("powierzchnia"))}
            atrybuty={{ inputMode: "decimal", min: 1, step: "any" }} />
          <Pole etykieta="Rok budowy" wymagane typ="number" podpowiedz="Budynku, w którym jest lokal"
            rejestracja={register(p("rok_budowy"))} atrybuty={rok} />
          <Pole etykieta="Rok ostatniego remontu" typ="number" podpowiedz="Jeśli był"
            rejestracja={register(p("rok_remontu"))} atrybuty={rok} />
          <PoleWybor etykieta="Materiał ścian" wymagane opcje={MATERIAL_SCIAN} rejestracja={register(p("material_scian"))} />
          <PoleWybor etykieta="Pokrycie dachu" wymagane opcje={POKRYCIE_DACHU} rejestracja={register(p("pokrycie_dachu"))} />
          <PoleWybor etykieta="Stan techniczny" wymagane opcje={STAN_TECHNICZNY} rejestracja={register(p("stan_techniczny"))} />
          <PoleWybor etykieta="Ogrzewanie" wymagane opcje={OGRZEWANIE} rejestracja={register(p("ogrzewanie"))} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PoleTakNie etykieta="Budynek własny (nie najemca)" rejestracja={register(p("budynek_wlasny"))} />
          <PoleTakNie etykieta="Materiały palne w produkcji / procesie" rejestracja={register(p("materialy_palne"))} />
        </div>
      </section>

      <section className="karta">
        <h2 className="naglowek-sekcji">Sekcja 4A — zabezpieczenia przeciwpożarowe</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Pole etykieta="Gaśnice (liczba sztuk)" typ="number" rejestracja={register(p("gasnice_szt"))}
            atrybuty={{ inputMode: "numeric", min: 0, max: 999, step: 1 }} />
          <Pole etykieta="Data przeglądu gaśnic" podpowiedz="dd.mm.rrrr" rejestracja={register(p("data_przegladu_gasnic"))} />
          <Pole etykieta="Odległość od PSP (km)" typ="number" podpowiedz="Najbliższa jednostka straży pożarnej"
            rejestracja={register(p("odleglosc_psp"))} atrybuty={{ inputMode: "decimal", min: 0, step: "any" }} />
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
          <Pole etykieta="Agencja ochrony (nazwa)" podpowiedz="np. Securitas — puste, jeśli brak"
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
              tylkoOdczyt={Boolean(zWykazu[pozycja.klucz])}
              podpowiedz={zWykazu[pozycja.klucz]}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-marka-50 px-4 py-3">
          <span className="text-sm font-medium text-marka-900">Suma lokalizacji</span>
          <span className="text-lg font-semibold tabular-nums text-marka-900">{zl(suma)}</span>
        </div>

        <p className="mt-3 text-xs text-stone-500">
          Sprzęt medyczny i elektronikę możesz wpisać tu jako kwotę albo dodać wykaz urządzeń w dalszych
          krokach — wtedy suma policzy się sama.
        </p>
      </section>
    </div>
  );
}
