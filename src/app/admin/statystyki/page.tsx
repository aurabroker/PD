import { zl } from "@/lib/format";
import { STATUS_ETYKIETY, type Status } from "@/lib/slowniki";
import { policzStatystyki, type Okres, type Rozklad } from "@/lib/statystyki";
import Kafelek from "@/components/panel/Kafelek";
import ListaSlupkow from "@/components/panel/ListaSlupkow";

export const dynamic = "force-dynamic";

const OKRESY: { klucz: Okres; etykieta: string }[] = [
  { klucz: "30", etykieta: "30 dni" },
  { klucz: "90", etykieta: "90 dni" },
  { klucz: "365", etykieta: "12 miesięcy" },
  { klucz: "wszystko", etykieta: "Od początku" },
];

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const naWiersze = (r: Rozklad) => r.map((x) => ({ etykieta: x.etykieta, wartosc: x.liczba, udzial: x.udzial }));
const MIESIACE = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

function Karta({ tytul, opis, children }: { tytul: string; opis?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-stone-900">{tytul}</h2>
      {opis && <p className="mt-0.5 text-xs text-stone-500">{opis}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Mały wykres słupkowy jednej serii w czasie — dwie serie = dwa wykresy, nigdy dwie osie. */
function Kolumny({ tytul, dane }: { tytul: string; dane: { miesiac: string; wartosc: number }[] }) {
  const max = Math.max(1, ...dane.map((d) => d.wartosc));
  const suma = dane.reduce((a, d) => a + d.wartosc, 0);
  return (
    <figure>
      <figcaption className="flex justify-between text-xs text-stone-500">
        <span>{tytul}</span>
        <span className="tabular-nums text-stone-700">łącznie {suma}</span>
      </figcaption>
      <div className="mt-2 flex h-24 items-end gap-1 border-b border-stone-200">
        {dane.map((d) => (
          <div key={d.miesiac} className="group relative flex h-full flex-1 items-end" title={`${d.miesiac}: ${d.wartosc}`}>
            <div className="w-full rounded-t bg-marka-600 transition group-hover:bg-marka-900" style={{ height: `${(d.wartosc / max) * 100}%`, minHeight: d.wartosc ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-stone-400">
        {dane.map((d) => (
          <span key={d.miesiac} className="flex-1 text-center">{MIESIACE[Number(d.miesiac.slice(5, 7)) - 1]}</span>
        ))}
      </div>
    </figure>
  );
}

export default async function Statystyki({ searchParams }: { searchParams: Promise<{ okres?: string }> }) {
  const { okres: o } = await searchParams;
  const okres: Okres = OKRESY.some((x) => x.klucz === o) ? (o as Okres) : "365";

  let s: Awaited<ReturnType<typeof policzStatystyki>>;
  try {
    s = await policzStatystyki(okres);
  } catch (e) {
    console.error("[statystyki]", e);
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Nie udało się policzyć statystyk: {e instanceof Error ? e.message : "nieznany błąd"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statystyki</h1>
          <p className="mt-0.5 text-sm text-stone-500">Wnioski złożone (bez roboczych), wg daty złożenia.</p>
        </div>
        <nav className="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm" aria-label="Okres">
          {OKRESY.map((x) => (
            <a
              key={x.klucz}
              href={`/admin/statystyki?okres=${x.klucz}`}
              className={`rounded-md px-3 py-1 ${x.klucz === okres ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
            >
              {x.etykieta}
            </a>
          ))}
        </nav>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Podsumowanie">
        <Kafelek etykieta="Wnioski złożone" wartosc={s.liczba} dopisek={`${s.lokalizacje} lokalizacji`} wyroznij />
        <Kafelek etykieta="Łączna suma ubezpieczenia" wartosc={zl(s.sumaLacznie)} dopisek={`średnio ${zl(s.sredniaSuma)} · mediana ${zl(s.medianaSumy)}`} />
        <Kafelek etykieta="Polisy zawarte" wartosc={s.polisy} dopisek={`konwersja z ofert: ${pct(s.konwersja)} (${s.oferty} ofert)`} wyroznij />
        <Kafelek etykieta="Składka z polis" wartosc={zl(s.skladkaPolis)} dopisek={s.polisy ? `średnio ${zl(s.sredniaSkladka)}` : "brak polis"} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Karta tytul="Suma ubezpieczenia wg kategorii" opis="Łącznie ze wszystkich lokalizacji; udział w łącznej sumie.">
          <ListaSlupkow wiersze={s.kategorie.map((k) => ({ etykieta: k.etykieta, wartosc: k.suma, udzial: k.udzial }))} format={zl} />
        </Karta>

        <Karta tytul="Zakres ubezpieczenia" opis="Ile wniosków obejmuje dane ryzyko (wniosek może mieć kilka).">
          <ListaSlupkow wiersze={naWiersze(s.zakres)} />
        </Karta>

        <Karta tytul="Lejek — obecny status" opis="Gdzie teraz są wnioski złożone w tym okresie.">
          <ListaSlupkow wiersze={naWiersze(s.lejek).map((w) => ({ ...w, etykieta: STATUS_ETYKIETY[w.etykieta as Status] ?? w.etykieta }))} />
        </Karta>

        <Karta tytul="Trend — ostatnie 12 miesięcy">
          <div className="space-y-5">
            <Kolumny tytul="Wnioski złożone" dane={s.trend.map((t) => ({ miesiac: t.miesiac, wartosc: t.zlozone }))} />
            <Kolumny tytul="Polisy zawarte" dane={s.trend.map((t) => ({ miesiac: t.miesiac, wartosc: t.polisy }))} />
          </div>
        </Karta>

        <Karta tytul="Powody rezygnacji">
          <ListaSlupkow wiersze={naWiersze(s.powodyRezygnacji)} pusto="Brak rezygnacji w wybranym okresie." />
        </Karta>

        <Karta tytul="Towarzystwa w naszych ofertach">
          <ListaSlupkow wiersze={naWiersze(s.towarzystwaOfert)} pusto="Brak ofert z podanym towarzystwem." />
        </Karta>

        <Karta tytul="Obecne ubezpieczenie klientów" opis={`${pct(s.obecnePolisy.udzial)} klientów ma polisę${s.obecnePolisy.sredniaSkladka ? `, średnia składka ${zl(s.obecnePolisy.sredniaSkladka)}` : ""}. Kto dziś ich ubezpiecza:`}>
          <ListaSlupkow wiersze={naWiersze(s.obecnePolisy.towarzystwa)} pusto="Brak danych o obecnych polisach." />
        </Karta>

        <Karta tytul="Ryzyko" opis={`Zabezpieczenia w ${s.lokalizacje} lokalizacjach. Szkody w ostatnich 5 latach: ${s.ryzyko.zeSzkodami} z ${s.liczba} wniosków (${s.ryzyko.liczbaSzkod} szkód, odszkodowania ${zl(s.ryzyko.sumaOdszkodowan)}). Budynek własny: ${pct(s.ryzyko.budynekWlasny)} lokalizacji.`}>
          <ListaSlupkow
            wiersze={s.ryzyko.zabezpieczenia.map((z) => ({ etykieta: z.etykieta, wartosc: z.liczba, udzial: z.udzial }))}
            format={(v) => `${v} z ${s.lokalizacje} lok.`}
            pusto="Brak lokalizacji w wybranym okresie."
          />
        </Karta>

        <Karta tytul="Sprzęt w wykazach">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">Sprzęt medyczny / estetyczny</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{s.sprzet.medyczny.sztuk} szt.</dd>
              <dd className="text-xs text-stone-500">wartość {zl(s.sprzet.medyczny.wartosc)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Elektronika (EEI)</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{s.sprzet.eei.sztuk} szt.</dd>
              <dd className="text-xs text-stone-500">wartość {zl(s.sprzet.eei.wartosc)}</dd>
            </div>
          </dl>
        </Karta>

        <Karta tytul="Typ lokalu">
          <ListaSlupkow wiersze={naWiersze(s.typLokalu)} />
        </Karta>

        <Karta tytul="Forma prawna">
          <ListaSlupkow wiersze={naWiersze(s.formaPrawna)} />
        </Karta>

        <Karta tytul="Liczba pracowników">
          <ListaSlupkow wiersze={naWiersze(s.pracownicy)} />
        </Karta>

        <Karta tytul="Roczny obrót">
          <ListaSlupkow wiersze={naWiersze(s.obrot)} />
        </Karta>

        <Karta tytul="Skąd przychodzą wnioski">
          <ListaSlupkow wiersze={naWiersze(s.zrodlo)} />
        </Karta>
      </div>
    </main>
  );
}
