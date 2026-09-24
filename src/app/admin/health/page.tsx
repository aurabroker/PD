import { redirect } from "next/navigation";
import { wymaganyAdmin } from "@/lib/autoryzacja";
import { raportZdrowia, type Sprawdzenie, type Stan } from "@/lib/zdrowie";

export const dynamic = "force-dynamic";

const WYGLAD: Record<Stan, { ikona: string; slowo: string; klasa: string }> = {
  ok: { ikona: "✓", slowo: "działa", klasa: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  uwaga: { ikona: "!", slowo: "uwaga", klasa: "border-amber-200 bg-amber-50 text-amber-900" },
  blad: { ikona: "✕", slowo: "wymaga interwencji", klasa: "border-red-200 bg-red-50 text-red-800" },
};

const GRUPY: Sprawdzenie["grupa"][] = ["Infrastruktura", "Bezpieczeństwo", "Integracje", "Panel"];

export default async function Health({ searchParams }: { searchParams: Promise<{ odswiez?: string }> }) {
  if (!(await wymaganyAdmin())) redirect("/admin");
  const { odswiez } = await searchParams;
  const r = await raportZdrowia(odswiez === "1");
  const bledy = r.sprawdzenia.filter((s) => s.stan === "blad");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <a href="/admin/health?odswiez=1" className="przycisk-drugi">Sprawdź teraz</a>
      </div>

      <div
        className={`mt-5 rounded-xl border px-5 py-4 ${r.stan === "ok" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
        data-stan-ogolny={r.stan}
      >
        <p className={`text-lg font-semibold ${r.stan === "ok" ? "text-emerald-800" : "text-red-800"}`}>
          {r.stan === "ok" ? "✓ Wszystko działa" : `✕ Wymaga interwencji: ${bledy.length}`}
        </p>
        <p className="mt-0.5 text-xs text-stone-600">
          Sprawdzono {new Date(r.sprawdzono).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} · wersja{" "}
          <code>{r.wersja.commit}</code> ({new Date(r.wersja.zbudowano).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}) ·
          wynik trzymany 5 min
        </p>
      </div>

      {GRUPY.map((g) => {
        const lista = r.sprawdzenia.filter((s) => s.grupa === g);
        if (!lista.length) return null;
        return (
          <section key={g} className="mt-6" aria-label={g}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">{g}</h2>
            <ul className="mt-2 space-y-2">
              {lista.map((s) => {
                const w = WYGLAD[s.stan];
                return (
                  <li key={s.id} className="flex gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3" data-sprawdzenie={s.id} data-stan={s.stan}>
                    <span className={`mt-0.5 flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-semibold ${w.klasa}`}>
                      <span aria-hidden>{w.ikona}</span> {w.slowo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{s.nazwa}</p>
                      <p className="break-words text-sm text-stone-600">{s.opis}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-stone-400">{s.ms} ms</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="mt-8 text-xs text-stone-500">
        Health pokazuje stan systemu. Sprawy operacyjne — wnioski czekające na agenta, nieprzypisane, kończące się polisy —
        są w sekcji „Wymaga uwagi” w Panelu agenta.
      </p>
    </main>
  );
}
