/**
 * Lista z poziomymi słupkami (jeden odcień marki = wielkość). Każdy wiersz ma
 * wprost wypisaną wartość i udział — słupek jest pomocą wzrokową, nie jedynym
 * nośnikiem informacji, więc lista działa też jako tabela.
 */
export default function ListaSlupkow({
  wiersze,
  format = (v) => String(v),
  pusto = "Brak danych w wybranym okresie.",
}: {
  wiersze: { etykieta: string; wartosc: number; udzial: number }[];
  format?: (v: number) => string;
  pusto?: string;
}) {
  const max = Math.max(0, ...wiersze.map((w) => w.wartosc));
  if (wiersze.length === 0 || max === 0) return <p className="text-sm text-stone-400">{pusto}</p>;

  return (
    <ul className="space-y-2">
      {wiersze.map((w) => (
        <li key={w.etykieta} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-sm" title={`${w.etykieta}: ${format(w.wartosc)} (${Math.round(w.udzial * 100)}%)`}>
          <span className="truncate text-stone-700">{w.etykieta}</span>
          <span className="text-right tabular-nums text-stone-900">
            {format(w.wartosc)} <span className="ml-1 text-xs text-stone-500">{Math.round(w.udzial * 100)}%</span>
          </span>
          <span className="col-span-2 mt-1 block h-2 rounded-full bg-stone-100" aria-hidden>
            <span
              className="block h-2 rounded-full bg-marka-600"
              style={{ width: `${w.wartosc > 0 ? Math.max(2, (w.wartosc / max) * 100) : 0}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
