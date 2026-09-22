"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { akcjaZapiszRoboczy, akcjaZlozWniosek } from "@/app/actions/wniosek";
import { pustaLokalizacja, sumaWniosku, wniosekSchema } from "@/lib/schema";
import type { Wniosek } from "@/lib/schema";
import {
  FORMA_PRAWNA,
  LICZBA_PRACOWNIKOW,
  POZYCJE_SUM,
  ROCZNY_OBROT,
  ZAKRES,
  ZAKRES_SKLADOWE_OGNIA,
} from "@/lib/slowniki";
import { Pole, PoleKwota, PoleObszar, PoleTakNie, PoleWybor, Sekcja, zl } from "@/components/pola";
import KrokLokalizacja from "./KrokLokalizacja";
import { TabelaSzkod, WykazElektroniki, WykazSprzetuMedycznego } from "./KrokiPomocnicze";

type Props = {
  token: string;
  wartosciPoczatkowe: Wniosek;
  zImportu: boolean;
  nrReferencyjny: string;
};

export default function KreatorWniosku({ token, wartosciPoczatkowe, zImportu, nrReferencyjny }: Props) {
  const metody = useForm<Wniosek>({
    defaultValues: wartosciPoczatkowe,
    resolver: zodResolver(wniosekSchema),
    mode: "onBlur",
  });

  const [krok, setKrok] = useState(0);
  const [stanZapisu, setStanZapisu] = useState<"bezzmian" | "zapisuje" | "zapisano" | "blad">("bezzmian");
  const [bladZapisu, setBladZapisu] = useState("");
  const [skladanie, setSkladanie] = useState(false);

  const lokalizacje = metody.watch("lokalizacje") ?? [];
  const liczbaLokalizacji = Math.max(1, lokalizacje.length);

  const kroki = useMemo(
    () => [
      { klucz: "firma", etykieta: "Dane firmy" },
      ...lokalizacje.map((_, i) => ({ klucz: `lok-${i}`, etykieta: `Lokalizacja ${i + 1}` })),
      { klucz: "medyczny", etykieta: "Sprzęt medyczny" },
      { klucz: "eei", etykieta: "Elektronika" },
      { klucz: "szkody", etykieta: "Szkodowość" },
      { klucz: "podsumowanie", etykieta: "Podsumowanie" },
    ],
    [lokalizacje.length],
  );

  const aktualny = kroki[Math.min(krok, kroki.length - 1)];

  /** Zapis roboczy. Wywolywany recznie i automatycznie po zmianie danych. */
  const zapisz = useCallback(async () => {
    setStanZapisu("zapisuje");
    setBladZapisu("");

    const wynik = await akcjaZapiszRoboczy(token, metody.getValues());

    if (wynik.ok) {
      setStanZapisu("zapisano");
    } else {
      setStanZapisu("blad");
      setBladZapisu(wynik.blad);
    }
  }, [token, metody]);

  // Autozapis: 3 s po ostatniej zmianie, zeby nie zalewac serwera przy pisaniu.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const subskrypcja = metody.watch(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void zapisz();
      }, 3000);
    });

    return () => {
      subskrypcja.unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [metody, zapisz]);

  async function zloz() {
    setSkladanie(true);
    setBladZapisu("");

    const wynik = await akcjaZlozWniosek(token, metody.getValues());

    // Przy powodzeniu akcja przekierowuje, wiec tutaj jestesmy tylko przy bledzie.
    if (!wynik.ok) {
      setSkladanie(false);
      setBladZapisu(wynik.blad);

      if (wynik.bledyPol) {
        for (const [sciezka, komunikat] of Object.entries(wynik.bledyPol)) {
          metody.setError(sciezka as never, { type: "server", message: komunikat });
        }
        // Przenosimy na krok, na ktorym jest pierwszy blad.
        const pierwszy = Object.keys(wynik.bledyPol)[0] ?? "";
        if (pierwszy.startsWith("lokalizacje.")) {
          setKrok(1 + Number(pierwszy.split(".")[1] || 0));
        } else if (pierwszy.startsWith("szkody")) {
          setKrok(kroki.findIndex((k) => k.klucz === "szkody"));
        } else if (pierwszy === "zakres" || pierwszy.startsWith("zgoda")) {
          setKrok(kroki.length - 1);
        } else {
          setKrok(0);
        }
      }
    }
  }

  return (
    <FormProvider {...metody}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wniosek o ubezpieczenie majątkowe</h1>
            <p className="mt-1 text-sm text-stone-500">Numer wniosku: {nrReferencyjny}</p>
          </div>
          <WskaznikZapisu stan={stanZapisu} onZapisz={zapisz} />
        </div>

        {zImportu && (
          <div className="mb-6 rounded-lg border border-marka-200 bg-marka-50 p-4 text-sm text-marka-900">
            Dane wczytaliśmy z Twojego arkusza. <strong>Sprawdź je krok po kroku</strong> — wniosek
            zostanie złożony dopiero po Twoim potwierdzeniu w ostatnim kroku.
          </div>
        )}

        <NawigacjaKrokow kroki={kroki} aktywny={krok} naKrok={setKrok} />

        <div className="mt-6">
          {aktualny.klucz === "firma" && <KrokDaneFirmy />}
          {aktualny.klucz.startsWith("lok-") && (
            <KrokLokalizacja indeks={Number(aktualny.klucz.split("-")[1])} />
          )}
          {aktualny.klucz === "medyczny" && (
            <Sekcja tytul="Wykaz sprzętu medycznego i estetycznego"
              opis="Urządzenia we wszystkich lokalizacjach. Wartość odtworzeniowa, czyli koszt zakupu nowego.">
              <WykazSprzetuMedycznego liczbaLokalizacji={liczbaLokalizacji} />
            </Sekcja>
          )}
          {aktualny.klucz === "eei" && (
            <Sekcja tytul="Wykaz sprzętu elektronicznego (EEI)"
              opis="Komputery, kasy fiskalne, terminale płatnicze, sprzęt IT.">
              <WykazElektroniki liczbaLokalizacji={liczbaLokalizacji} />
            </Sekcja>
          )}
          {aktualny.klucz === "szkody" && (
            <Sekcja tytul="Sekcja 7 — historia szkodowości" opis="Szkody z ostatnich 5 lat.">
              <TabelaSzkod />
            </Sekcja>
          )}
          {aktualny.klucz === "podsumowanie" && <KrokPodsumowanie />}
        </div>

        {bladZapisu && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{bladZapisu}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-6">
          <button type="button" onClick={() => setKrok((k) => Math.max(0, k - 1))}
            disabled={krok === 0} className="przycisk-drugi">
            ← Wstecz
          </button>

          <div className="flex gap-3">
            <button type="button" onClick={zapisz} className="przycisk-drugi">
              Zapisz i dokończ później
            </button>
            {krok < kroki.length - 1 ? (
              <button type="button" onClick={() => setKrok((k) => Math.min(kroki.length - 1, k + 1))}
                className="przycisk-glowny">
                Dalej →
              </button>
            ) : (
              <button type="button" onClick={zloz} disabled={skladanie} className="przycisk-glowny">
                {skladanie ? "Wysyłam…" : "Złóż wniosek"}
              </button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

function WskaznikZapisu({ stan, onZapisz }: { stan: string; onZapisz: () => void }) {
  if (stan === "zapisuje") return <span className="text-sm text-stone-500">Zapisuję…</span>;
  if (stan === "zapisano") return <span className="text-sm text-emerald-700">Zapisano ✓</span>;
  if (stan === "blad")
    return (
      <button type="button" onClick={onZapisz} className="text-sm text-red-600 underline">
        Nie zapisano — spróbuj ponownie
      </button>
    );
  return <span className="text-sm text-stone-400">Zapis automatyczny włączony</span>;
}

function NawigacjaKrokow({
  kroki,
  aktywny,
  naKrok,
}: {
  kroki: { klucz: string; etykieta: string }[];
  aktywny: number;
  naKrok: (n: number) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Kroki wniosku">
      {kroki.map((krok, i) => (
        <button
          key={krok.klucz}
          type="button"
          onClick={() => naKrok(i)}
          aria-current={i === aktywny ? "step" : undefined}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${
            i === aktywny
              ? "bg-marka-700 text-white"
              : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
          }`}
        >
          <span className="mr-1.5 text-xs opacity-60">{i + 1}</span>
          {krok.etykieta}
        </button>
      ))}
    </nav>
  );
}

function KrokDaneFirmy() {
  const { register, control, formState } = useFormContext<Wniosek>();
  const bledy = formState.errors;
  const { fields, append, remove } = useFieldArray({ control, name: "lokalizacje" });

  return (
    <div className="space-y-6">
      <Sekcja tytul="Sekcja 1 — dane ubezpieczającego">
        <div className="grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Nazwa firmy / imię i nazwisko" wymagane blad={bledy.nazwa_firmy}
            rejestracja={register("nazwa_firmy")} />
          <Pole etykieta="NIP" podpowiedz="10 cyfr" blad={bledy.nip} rejestracja={register("nip")} />
          <Pole etykieta="REGON" rejestracja={register("regon")} />
          <Pole etykieta="KRS" rejestracja={register("krs")} />
          <PoleWybor etykieta="Forma prawna" opcje={FORMA_PRAWNA} rejestracja={register("forma_prawna")} />
          <Pole etykieta="Numer PKD" podpowiedz="np. 96.02.Z" rejestracja={register("numer_pkd")} />
          <div className="sm:col-span-2">
            <Pole etykieta="Adres siedziby" wymagane blad={bledy.adres_siedziby}
              rejestracja={register("adres_siedziby")} />
          </div>
          <Pole etykieta="E-mail kontaktowy" typ="email" wymagane blad={bledy.email_kontaktowy}
            rejestracja={register("email_kontaktowy")} />
          <Pole etykieta="Telefon" wymagane blad={bledy.telefon} rejestracja={register("telefon")} />
          <Pole etykieta="Osoba do kontaktu" rejestracja={register("osoba_kontaktu")} />
          <Pole etykieta="Stanowisko" rejestracja={register("stanowisko")} />
        </div>
      </Sekcja>

      <Sekcja tytul="Sekcja 3 — profil działalności">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Pole etykieta="Rodzaj działalności" wymagane
              podpowiedz="np. Salon kosmetyczny, klinika medycyny estetycznej"
              blad={bledy.rodzaj_dzialalnosci} rejestracja={register("rodzaj_dzialalnosci")} />
          </div>
          <PoleWybor etykieta="Liczba pracowników" opcje={LICZBA_PRACOWNIKOW}
            rejestracja={register("liczba_pracownikow")} />
          <PoleWybor etykieta="Szacunkowy roczny obrót" opcje={ROCZNY_OBROT}
            rejestracja={register("roczny_obrot")} />
        </div>
      </Sekcja>

      <Sekcja tytul="Lokalizacje" opis="Dodaj każdą lokalizację, która ma być objęta ochroną (maksymalnie 3).">
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5">
              <span className="text-sm text-stone-700">Lokalizacja {i + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(i)}
                  className="text-xs text-stone-400 hover:text-red-600">
                  Usuń
                </button>
              )}
            </div>
          ))}
        </div>
        {fields.length < 3 && (
          <button type="button" onClick={() => append(pustaLokalizacja(fields.length + 1))}
            className="przycisk-drugi mt-4">
            + Dodaj lokalizację
          </button>
        )}
      </Sekcja>
    </div>
  );
}

function KrokPodsumowanie() {
  const { register, watch, formState } = useFormContext<Wniosek>();
  const dane = watch();
  const bledy = formState.errors;
  const posiadaPolise = watch("posiada_polise");

  const suma = sumaWniosku({ lokalizacje: dane.lokalizacje ?? [] });

  return (
    <div className="space-y-6">
      <Sekcja tytul="Sekcja 5 — zakres ubezpieczenia" opis="Zaznacz ryzyka, którymi jesteś zainteresowany.">
        <div className="space-y-2">
          {ZAKRES.map((pozycja) => {
            const skladowa = (ZAKRES_SKLADOWE_OGNIA as readonly string[]).includes(pozycja);
            return (
              <label key={pozycja}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 transition hover:border-marka-200 ${
                  skladowa ? "ml-6" : ""
                }`}>
                <input type="checkbox" value={pozycja} {...register("zakres")}
                  className="h-4 w-4 rounded border-stone-300 text-marka-700 focus:ring-marka-400" />
                <span className="text-sm text-stone-700">
                  {skladowa && <span className="mr-1.5 text-stone-400">↳</span>}
                  {pozycja}
                  {skladowa && (
                    <span className="ml-2 text-xs text-stone-400">składowa „Mienia od ognia"</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {bledy.zakres?.message && <p className="komunikat-bledu">{bledy.zakres.message}</p>}
      </Sekcja>

      <Sekcja tytul="Sekcja 6 — łączna suma ubezpieczenia">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="pb-2 font-medium">Kategoria</th>
                {(dane.lokalizacje ?? []).map((_, i) => (
                  <th key={i} className="pb-2 text-right font-medium">Lok. {i + 1}</th>
                ))}
                <th className="pb-2 text-right font-medium">Razem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {POZYCJE_SUM.map((pozycja) => {
                const wartosci = (dane.lokalizacje ?? []).map(
                  (lok) => Number(lok?.[pozycja.klucz]) || 0,
                );
                const razem = wartosci.reduce((a, b) => a + b, 0);
                return (
                  <tr key={pozycja.klucz}>
                    <td className="py-2 text-stone-700">{pozycja.etykieta}</td>
                    {wartosci.map((w, i) => (
                      <td key={i} className="py-2 text-right tabular-nums text-stone-600">{zl(w)}</td>
                    ))}
                    <td className="py-2 text-right font-medium tabular-nums">{zl(razem)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300">
                <td className="pt-3 font-medium">Łączna suma ubezpieczenia</td>
                <td colSpan={(dane.lokalizacje ?? []).length} />
                <td className="pt-3 text-right text-lg font-semibold tabular-nums text-marka-900">
                  {zl(suma)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {bledy.lokalizacje?.message && <p className="komunikat-bledu">{bledy.lokalizacje.message}</p>}
      </Sekcja>

      <Sekcja tytul="Sekcja 8 — dotychczasowe ubezpieczenie mienia">
        <PoleTakNie etykieta="Posiadam aktualną polisę na mienie" rejestracja={register("posiada_polise")} />
        {posiadaPolise && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Pole etykieta="Towarzystwo ubezpieczeń" podpowiedz="np. PZU, Allianz, Warta"
              rejestracja={register("towarzystwo_obecne")} />
            <Pole etykieta="Numer polisy" rejestracja={register("nr_polisy_obecny")} />
            <Pole etykieta="Ważność polisy do" podpowiedz="dd.mm.rrrr" rejestracja={register("waznosc_do")} />
            <PoleKwota etykieta="Roczna składka" rejestracja={register("roczna_skladka_obecna")} />
          </div>
        )}
      </Sekcja>

      <Sekcja tytul="Sekcja 9 — uwagi i oświadczenia">
        <PoleObszar etykieta="Uwagi, opis działalności, pytania do agenta"
          rejestracja={register("uwagi")} />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Miejscowość" wymagane rejestracja={register("miejscowosc_podpisu")} />
          <Pole etykieta="Data" typ="date" rejestracja={register("data_podpisu")} />
        </div>

        <div className="mt-5 space-y-3">
          <PoleTakNie
            etykieta="Oświadczam, że wszystkie informacje podane we wniosku są zgodne z prawdą i odzwierciedlają rzeczywisty stan faktyczny."
            rejestracja={register("zgoda_prawdziwosc")} />
          {bledy.zgoda_prawdziwosc?.message && (
            <p className="komunikat-bledu">{bledy.zgoda_prawdziwosc.message}</p>
          )}

          <PoleTakNie
            etykieta="Wyrażam zgodę na przetwarzanie moich danych osobowych przez Aura Expert sp. z o.o. w celu przygotowania oferty ubezpieczenia, zgodnie z RODO."
            rejestracja={register("zgoda_rodo")} />
          {bledy.zgoda_rodo?.message && <p className="komunikat-bledu">{bledy.zgoda_rodo.message}</p>}
        </div>
      </Sekcja>
    </div>
  );
}
