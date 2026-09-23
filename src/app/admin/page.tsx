import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUS, STATUS_ETYKIETY } from "@/lib/slowniki";
import { zl } from "@/lib/format";

export const dynamic = "force-dynamic";

type Parametry = { status?: string; szukaj?: string };

export default async function ListaWnioskow({
  searchParams,
}: {
  searchParams: Promise<Parametry>;
}) {
  const { status, szukaj } = await searchParams;

  let zapytanie = supabaseAdmin()
    .from("mienie_wnioski")
    .select(
      "id, nr_referencyjny, nazwa_firmy, nip, email_kontaktowy, telefon, status, zrodlo, suma_lacznie, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && (STATUS as readonly string[]).includes(status)) {
    zapytanie = zapytanie.eq("status", status);
  }

  if (szukaj?.trim()) {
    const fraza = `%${szukaj.trim()}%`;
    zapytanie = zapytanie.or(
      `nazwa_firmy.ilike.${fraza},nip.ilike.${fraza},email_kontaktowy.ilike.${fraza},nr_referencyjny.ilike.${fraza}`,
    );
  }

  // Wyjatek (np. zerwane polaczenie) zamieniamy na komunikat na stronie -
  // inaczej panel pokazuje gole 500 bez wskazowki, co sie stalo.
  let wnioski: Awaited<typeof zapytanie>["data"] = null;
  let error: { message: string } | null = null;
  try {
    const wynik = await zapytanie;
    wnioski = wynik.data;
    error = wynik.error;
  } catch (e) {
    console.error("[admin/lista] wyjatek zapytania:", e);
    error = { message: e instanceof Error ? e.message : "Nie udało się pobrać wniosków." };
  }

  const lacznie = (wnioski ?? []).reduce((acc, w) => acc + (Number(w.suma_lacznie) || 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Wnioski majątkowe</h1>
        <p className="text-sm text-stone-500">
          {wnioski?.length ?? 0} wniosków · łączna suma {zl(lacznie)}
        </p>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          name="szukaj"
          defaultValue={szukaj ?? ""}
          placeholder="Nazwa firmy, NIP, e-mail lub numer wniosku"
          className="pole max-w-sm flex-1"
        />
        <select name="status" defaultValue={status ?? ""} className="pole max-w-[12rem]">
          <option value="">Wszystkie statusy</option>
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_ETYKIETY[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="przycisk-drugi">Filtruj</button>
        <a href="/api/admin/eksport" className="przycisk-drugi ml-auto">Eksport XLSX</a>
      </form>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.message}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Numer</th>
              <th className="px-4 py-3 font-medium">Ubezpieczający</th>
              <th className="px-4 py-3 font-medium">Kontakt</th>
              <th className="px-4 py-3 text-right font-medium">Suma</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Zmieniony</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(wnioski ?? []).map((w) => (
              <tr key={w.id} className="transition hover:bg-stone-50">
                <td className="px-4 py-3">
                  <a href={`/admin/wnioski/${w.id}`} className="font-medium text-marka-700 hover:underline">
                    {w.nr_referencyjny}
                  </a>
                  <span className="mt-0.5 block text-xs text-stone-400">
                    {w.zrodlo === "excel" ? "z pliku Excel" : w.zrodlo === "agent" ? "agent" : "formularz"}
                  </span>
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
                <td className="px-4 py-3">
                  <Znacznik status={w.status} />
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {new Date(w.updated_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(wnioski?.length ?? 0) === 0 && (
          <p className="px-4 py-10 text-center text-sm text-stone-500">
            Brak wniosków spełniających kryteria.
          </p>
        )}
      </div>
    </main>
  );
}

function Znacznik({ status }: { status: string }) {
  const kolory: Record<string, string> = {
    roboczy: "bg-stone-100 text-stone-600",
    zlozony: "bg-blue-50 text-blue-700",
    w_ocenie: "bg-amber-50 text-amber-800",
    wyceniony: "bg-violet-50 text-violet-700",
    zaakceptowany: "bg-emerald-50 text-emerald-700",
    odrzucony: "bg-red-50 text-red-700",
    archiwalny: "bg-stone-100 text-stone-400",
  };

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${kolory[status] ?? "bg-stone-100"}`}>
      {STATUS_ETYKIETY[status as keyof typeof STATUS_ETYKIETY] ?? status}
    </span>
  );
}
