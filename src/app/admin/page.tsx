import { biezacyAgent } from "@/lib/autoryzacja";
import { STATUS, STATUS_ETYKIETY } from "@/lib/slowniki";
import { zl } from "@/lib/format";
import {
  nazwaAgenta,
  pasujeDoAlertu,
  pobierzAgentow,
  pobierzWnioski,
  policzLiczniki,
  type AgentSkrot,
  type Liczniki,
  type WierszWniosku,
} from "@/lib/statystyki";
import Kafelek from "@/components/panel/Kafelek";
import ZnacznikStatusu from "@/components/panel/ZnacznikStatusu";

export const dynamic = "force-dynamic";

type Parametry = { status?: string; szukaj?: string; agent?: string; uwaga?: string };

const ALERTY: { klucz: keyof Liczniki["uwaga"]; etykieta: string }[] = [
  { klucz: "nieprzypisane", etykieta: "bez przypisanego agenta" },
  { klucz: "czekajaPonad2Dni", etykieta: "czeka na agenta ponad 2 dni" },
  { klucz: "polisaKlientaWygasa30", etykieta: "obecna polisa klienta kończy się w ciągu 30 dni" },
  { klucz: "plikNiezgodny", etykieta: "plik Excel niezgodny z szablonem" },
  { klucz: "odnowienia60", etykieta: "nasza polisa do odnowienia w ciągu 60 dni" },
];

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default async function PanelGlowny({ searchParams }: { searchParams: Promise<Parametry> }) {
  const { status, szukaj, agent: filtrAgenta, uwaga } = await searchParams;
  const sesja = (await biezacyAgent())!;

  let wnioski: WierszWniosku[] = [];
  let agenci: AgentSkrot[] = [];
  let blad = "";
  try {
    [wnioski, agenci] = await Promise.all([pobierzWnioski(), pobierzAgentow()]);
  } catch (e) {
    // Wyjątek zamieniamy na komunikat — inaczej panel pokazuje gołe 500.
    console.error("[admin] odczyt:", e);
    blad = e instanceof Error ? e.message : "Nie udało się pobrać wniosków.";
  }

  const teraz = new Date();
  const l = policzLiczniki(wnioski, teraz);
  const poId = new Map(agenci.map((a) => [a.user_id, a]));

  // --- filtry listy ---
  const fraza = (szukaj ?? "").trim().toLowerCase();
  let lista = wnioski;
  if (status && (STATUS as readonly string[]).includes(status)) lista = lista.filter((w) => w.status === status);
  if (filtrAgenta === "moje") lista = lista.filter((w) => w.przypisany_agent === sesja.agent.user_id);
  else if (filtrAgenta === "brak") lista = lista.filter((w) => !w.przypisany_agent);
  else if (filtrAgenta) lista = lista.filter((w) => w.przypisany_agent === filtrAgenta);
  const alert = ALERTY.find((a) => a.klucz === uwaga);
  if (alert) lista = lista.filter((w) => pasujeDoAlertu(w, alert.klucz, teraz));
  if (fraza) {
    lista = lista.filter((w) =>
      [w.nazwa_firmy, w.nip, w.email_kontaktowy, w.nr_referencyjny].some((v) => (v ?? "").toLowerCase().includes(fraza)),
    );
  }
  lista = [...lista].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pokazane = lista.slice(0, 200);
  const filtrowane = Boolean(status || filtrAgenta || alert || fraza);

  const alertyAktywne = ALERTY.filter((a) => l.uwaga[a.klucz] > 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Panel agenta</h1>
        <p className="text-sm text-stone-500">
          {l.nowe7dni > 0 ? `+${l.nowe7dni} złożonych w ostatnich 7 dniach` : "Brak nowych wniosków w ostatnich 7 dniach"}
        </p>
      </div>

      {blad && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{blad}</p>}

      <section aria-label="Lejek wniosków" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Kafelek etykieta="Wnioski złożone" wartosc={l.zlozone} href="/admin" wyroznij />
        <Kafelek etykieta="Czekają na agenta" wartosc={l.czekajace} href="/admin?status=zlozony" />
        <Kafelek etykieta="W ocenie" wartosc={l.wOcenie} href="/admin?status=w_ocenie" />
        <Kafelek etykieta="Oferty przedstawione" wartosc={l.oferty} href="/admin?status=wyceniony" />
        <Kafelek etykieta="Polisy zawarte" wartosc={l.polisy} href="/admin?status=polisa" wyroznij />
        <Kafelek etykieta="Rezygnacje" wartosc={l.rezygnacje} href="/admin?status=rezygnacja" />
        <Kafelek etykieta="Odrzucone" wartosc={l.odrzucone} href="/admin?status=odrzucony" />
        <Kafelek etykieta="W trakcie wypełniania" wartosc={l.robocze} href="/admin?status=roboczy" />
      </section>

      <section aria-label="Wyniki" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kafelek
          etykieta="Konwersja oferta → polisa"
          wartosc={pct(l.konwersja)}
          dopisek={l.oferty ? `${l.polisy} z ${l.oferty} ofert` : "brak ofert"}
        />
        <Kafelek etykieta="Składka z zawartych polis" wartosc={zl(l.skladkaPolis)} dopisek="roczna, łącznie" />
        <Kafelek etykieta="Suma ubezpieczenia wniosków w toku" wartosc={zl(l.sumaWToku)} dopisek="złożone, w ocenie, z ofertą" />
      </section>

      {alertyAktywne.length > 0 && (
        <section aria-label="Wymaga uwagi" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-amber-900">⚠ Wymaga uwagi</h2>
          <ul className="mt-1.5 flex flex-wrap gap-2 text-sm">
            {alertyAktywne.map((a) => (
              <li key={a.klucz}>
                <a
                  href={`/admin?uwaga=${a.klucz}`}
                  className="inline-block rounded-full border border-amber-300 bg-white px-3 py-1 text-amber-900 hover:border-amber-500"
                >
                  <strong className="tabular-nums">{l.uwaga[a.klucz]}</strong> {a.etykieta}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mt-8 flex flex-wrap gap-3">
        <input
          type="search"
          name="szukaj"
          defaultValue={szukaj ?? ""}
          placeholder="Nazwa firmy, NIP, e-mail lub numer wniosku"
          className="pole max-w-sm flex-1"
        />
        <select name="status" defaultValue={status ?? ""} className="pole max-w-[13rem]" aria-label="Status">
          <option value="">Wszystkie statusy</option>
          {STATUS.map((s) => (
            <option key={s} value={s}>{STATUS_ETYKIETY[s]}</option>
          ))}
        </select>
        <select name="agent" defaultValue={filtrAgenta ?? ""} className="pole max-w-[13rem]" aria-label="Agent">
          <option value="">Wszyscy agenci</option>
          <option value="moje">Moje wnioski</option>
          <option value="brak">Nieprzypisane</option>
          {agenci.map((a) => (
            <option key={a.user_id} value={a.user_id}>
              {nazwaAgenta(a)}{a.aktywny ? "" : " (nieaktywny)"}
            </option>
          ))}
        </select>
        {uwaga && <input type="hidden" name="uwaga" value={uwaga} />}
        <button type="submit" className="przycisk-drugi">Filtruj</button>
        {filtrowane && <a href="/admin" className="self-center text-sm text-stone-500 underline">wyczyść</a>}
        <a href="/api/admin/eksport" className="przycisk-drugi ml-auto">Eksport XLSX</a>
      </form>

      <p className="mt-3 text-sm text-stone-500">
        {alert && <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">{alert.etykieta}</span>}
        {lista.length} {lista.length === 1 ? "wniosek" : "wniosków"} · suma {zl(lista.reduce((a, w) => a + (Number(w.suma_lacznie) || 0), 0))}
        {lista.length > pokazane.length && ` · pokazano ${pokazane.length} najnowszych`}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Numer</th>
              <th className="px-4 py-3 font-medium">Ubezpieczający</th>
              <th className="px-4 py-3 font-medium">Kontakt</th>
              <th className="px-4 py-3 text-right font-medium">Suma</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Zmieniony</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {pokazane.map((w) => (
              <tr key={w.id} className="transition hover:bg-stone-50">
                <td className="px-4 py-3">
                  <a href={`/admin/wnioski/${w.id}`} className="font-medium text-marka-700 hover:underline">
                    {w.nr_referencyjny}
                  </a>
                  <span className="mt-0.5 block text-xs text-stone-400">
                    {w.zrodlo === "excel" ? "z pliku Excel" : w.zrodlo === "agent" ? "agent" : "formularz"}
                  </span>
                  {w.import_zgodnosc?.zgodny === false && (
                    <span className="mt-0.5 block text-xs font-medium text-amber-700" title="Zaczytany plik różni się od naszego szablonu — szczegóły we wniosku">
                      ⚠ plik niezgodny z szablonem
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="block">{w.nazwa_firmy || <em className="text-stone-400">bez nazwy</em>}</span>
                  {w.nip && <span className="text-xs text-stone-400">NIP {w.nip}</span>}
                </td>
                <td className="px-4 py-3 text-stone-600">
                  <span className="block text-xs">{w.email_kontaktowy}</span>
                  <span className="block text-xs">{w.telefon}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{zl(Number(w.suma_lacznie) || 0)}</td>
                <td className="px-4 py-3"><ZnacznikStatusu status={w.status} /></td>
                <td className="px-4 py-3 text-xs">
                  {w.przypisany_agent ? (
                    <span className={w.przypisany_agent === sesja.agent.user_id ? "font-medium text-marka-900" : "text-stone-700"}>
                      {w.przypisany_agent === sesja.agent.user_id ? "Ty" : nazwaAgenta(poId.get(w.przypisany_agent))}
                    </span>
                  ) : (
                    <span className="text-stone-400">nieprzypisany</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {new Date(w.updated_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pokazane.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-stone-500">Brak wniosków spełniających kryteria.</p>
        )}
      </div>
    </main>
  );
}
