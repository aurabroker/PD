import { redirect } from "next/navigation";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { zl } from "@/lib/format";
import { STATUSY_OTWARTE, STATUSY_Z_OFERTA } from "@/lib/slowniki";
import { nazwaAgenta, pobierzAgentow, pobierzWnioski } from "@/lib/statystyki";
import ZnacznikStatusu from "@/components/panel/ZnacznikStatusu";
import { AkcjeAgenta, FormularzAgenta, SzybkiPrzydzial } from "./ZarzadzanieAgentami";

export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default async function Agenci() {
  const sesja = await wymaganyAdmin();
  if (!sesja) redirect("/admin");

  const [agenci, wnioski] = await Promise.all([pobierzAgentow(), pobierzWnioski()]);
  const otwarty = (s: string) => (STATUSY_OTWARTE as readonly string[]).includes(s);

  const wyniki = agenci.map((a) => {
    const jego = wnioski.filter((w) => w.przypisany_agent === a.user_id);
    const oferty = jego.filter((w) => (STATUSY_Z_OFERTA as readonly string[]).includes(w.status) || w.oferta_skladka != null).length;
    const polisy = jego.filter((w) => w.status === "polisa");
    return {
      agent: a,
      wToku: jego.filter((w) => otwarty(w.status)).length,
      czekaja: jego.filter((w) => w.status === "zlozony").length,
      oferty,
      polisy: polisy.length,
      konwersja: oferty ? polisy.length / oferty : null,
      skladka: polisy.reduce((s, w) => s + (Number(w.polisa_skladka) || 0), 0),
    };
  });

  const aktywni = agenci.filter((a) => a.aktywny).map((a) => ({ user_id: a.user_id, nazwa: nazwaAgenta(a) }));
  const pula = wnioski
    .filter((w) => otwarty(w.status) && !w.przypisany_agent)
    .sort((a, b) => (a.wyslano_at ?? a.created_at).localeCompare(b.wyslano_at ?? b.created_at));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenci</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Administrator zarządza agentami i przydziela wnioski. Agent widzi wszystkie wnioski, ale zmienia tylko swoje i nieprzypisane.
        </p>
      </div>

      <FormularzAgenta />

      <section className="overflow-x-auto rounded-xl border border-stone-200 bg-white" aria-label="Lista agentów">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 text-right font-medium">W toku</th>
              <th className="px-4 py-3 text-right font-medium">Oferty</th>
              <th className="px-4 py-3 text-right font-medium">Polisy</th>
              <th className="px-4 py-3 text-right font-medium">Konwersja</th>
              <th className="px-4 py-3 text-right font-medium">Składka</th>
              <th className="px-4 py-3 font-medium">Dostęp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {wyniki.map(({ agent: a, ...w }) => (
              <tr key={a.user_id} className={a.aktywny ? "" : "bg-stone-50 text-stone-400"} data-agent={a.email}>
                <td className="px-4 py-3">
                  <a href={`/admin?agent=${a.user_id}`} className="font-medium text-marka-700 hover:underline">{nazwaAgenta(a)}</a>
                  <span className="block text-xs text-stone-500">{a.email}</span>
                  {!a.aktywny && <span className="text-xs font-medium text-stone-500">nieaktywny</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {w.wToku}
                  {w.czekaja > 0 && <span className="block text-xs text-amber-700">{w.czekaja} czeka</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{w.oferty}</td>
                <td className="px-4 py-3 text-right tabular-nums">{w.polisy}</td>
                <td className="px-4 py-3 text-right tabular-nums">{pct(w.konwersja)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{zl(w.skladka)}</td>
                <td className="px-4 py-3">
                  <AkcjeAgenta userId={a.user_id} rola={a.rola} aktywny={a.aktywny} ja={a.user_id === sesja.agent.user_id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5" aria-label="Wnioski do przydzielenia">
        <h2 className="text-sm font-semibold">Wnioski do przydzielenia ({pula.length})</h2>
        <p className="mt-0.5 text-xs text-stone-500">Wnioski w toku bez agenta — najstarsze na górze.</p>
        {pula.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">Wszystkie wnioski w toku mają agenta.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {pula.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <a href={`/admin/wnioski/${w.id}`} className="font-medium text-marka-700 hover:underline">{w.nr_referencyjny}</a>
                  <span className="ml-2 text-stone-700">{w.nazwa_firmy || "bez nazwy"}</span>
                  <span className="ml-2 text-xs text-stone-500">
                    złożony {new Date(w.wyslano_at ?? w.created_at).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })} · {zl(Number(w.suma_lacznie) || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <ZnacznikStatusu status={w.status} />
                  <SzybkiPrzydzial wniosekId={w.id} agenci={aktywni} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
