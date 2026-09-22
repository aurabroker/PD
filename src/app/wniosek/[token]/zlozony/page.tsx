import { notFound } from "next/navigation";
import { pobierzWniosek } from "@/lib/wnioski";
import { zl } from "@/components/pola";
import { sumaWniosku } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function StronaZlozony({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wynik = await pobierzWniosek(token);
  if (!wynik) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="karta">
        <span className="naglowek-sekcji">Wniosek przyjęty</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Dziękujemy</h1>
        <p className="mt-3 text-stone-600">
          Wniosek <strong>{wynik.meta.nr_referencyjny}</strong> trafił do naszych agentów.
          Skontaktujemy się z Tobą na adres {wynik.meta.email_kontaktowy}.
        </p>

        <dl className="mt-6 space-y-2 rounded-lg bg-stone-50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Ubezpieczający</dt>
            <dd className="font-medium">{wynik.dane.nazwa_firmy}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Lokalizacje</dt>
            <dd className="font-medium">{wynik.dane.lokalizacje.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Łączna suma ubezpieczenia</dt>
            <dd className="font-medium tabular-nums">{zl(sumaWniosku(wynik.dane))}</dd>
          </div>
        </dl>

        <a href={`/api/wniosek/${token}/excel`} className="przycisk-glowny mt-6 w-full">
          Pobierz wniosek (.xlsx)
        </a>
      </div>
    </main>
  );
}
