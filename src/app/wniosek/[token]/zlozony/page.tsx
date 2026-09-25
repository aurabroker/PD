import { notFound } from "next/navigation";
import { pobierzWniosek } from "@/lib/wnioski";
import { zl } from "@/lib/format";
import { sumaWniosku } from "@/lib/schema";
import { losujBaner } from "@/lib/email/promo";
import BanerPromo from "@/components/BanerPromo";
import SerwisyAura from "@/components/SerwisyAura";

export const dynamic = "force-dynamic";

export default async function StronaZlozony({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wynik = await pobierzWniosek(token);
  if (!wynik) notFound();
  const baner = losujBaner("strona");

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="karta">
        <span className="naglowek-sekcji">Wniosek przyjęty</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Dziękujemy</h1>
        <p className="mt-3 text-stone-600">
          Wniosek <strong>{wynik.meta.nr_referencyjny}</strong> trafił do naszych agentów.
          Skontaktujemy się z Tobą na adres {wynik.meta.email_kontaktowy}.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Na ten adres wysłaliśmy też potwierdzenie z kopią wniosku w PDF, informacją o dystrybutorze
          i notą RODO. Nie widzisz wiadomości? Sprawdź folder spam.
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

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <a href={`/api/wniosek/${token}/pdf`} className="przycisk-glowny w-full">
            Pobierz kopię (PDF)
          </a>
          <a href={`/api/wniosek/${token}/excel`} className="przycisk-drugi w-full">
            Pobierz plik .xlsx
          </a>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          Dystrybutor:{" "}
          <a href="/dokumenty/aura-expert-informacja-o-dystrybutorze.pdf" className="underline hover:text-marka-700">
            informacja o Aura Expert sp. z o.o.
          </a>{" "}
          ·{" "}
          <a href="/dokumenty/aura-expert-nota-rodo.pdf" className="underline hover:text-marka-700">
            nota informacyjna RODO
          </a>
        </p>
      </div>

      <BanerPromo baner={baner} />

      <SerwisyAura waska />
    </main>
  );
}
