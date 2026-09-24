/**
 * Kafelek z liczbą (stat tile): etykieta, wartość, opcjonalny dopisek.
 * Link do przefiltrowanej listy — liczba zawsze prowadzi do wniosków, które liczy.
 */
export default function Kafelek({
  etykieta,
  wartosc,
  dopisek,
  href,
  wyroznij,
}: {
  etykieta: string;
  wartosc: string | number;
  dopisek?: string;
  href?: string;
  wyroznij?: boolean;
}) {
  const tresc = (
    <>
      <span className="block text-xs text-stone-500">{etykieta}</span>
      <span className={`mt-1 block text-2xl font-semibold tabular-nums ${wyroznij ? "text-marka-900" : "text-stone-900"}`}>
        {wartosc}
      </span>
      {dopisek && <span className="mt-0.5 block text-xs text-stone-500">{dopisek}</span>}
    </>
  );
  const klasa = `block rounded-xl border bg-white px-4 py-3 ${wyroznij ? "border-marka-200" : "border-stone-200"}`;
  return href ? (
    <a href={href} className={`${klasa} transition hover:border-marka-400 hover:shadow-sm`} data-kafelek={etykieta}>
      {tresc}
    </a>
  ) : (
    <div className={klasa} data-kafelek={etykieta}>{tresc}</div>
  );
}
