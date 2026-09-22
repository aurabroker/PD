import { notFound } from "next/navigation";
import KreatorWniosku from "@/components/formularz/KreatorWniosku";
import { pobierzWniosek } from "@/lib/wnioski";

export const dynamic = "force-dynamic";

export default async function StronaWniosku({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ zrodlo?: string }>;
}) {
  const { token } = await params;
  const { zrodlo } = await searchParams;

  const wynik = await pobierzWniosek(token);
  if (!wynik) notFound();

  if (wynik.wygasl) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="karta">
          <h1 className="text-xl font-semibold">Link wygasł</h1>
          <p className="mt-3 text-sm text-stone-600">
            Ten link do wniosku stracił ważność. Skontaktuj się ze swoim agentem Aura Expert —
            przedłuży go w kilka sekund.
          </p>
        </div>
      </main>
    );
  }

  if (wynik.meta.status !== "roboczy") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="karta">
          <h1 className="text-xl font-semibold">Wniosek został już złożony</h1>
          <p className="mt-3 text-sm text-stone-600">
            Numer wniosku: <strong>{wynik.meta.nr_referencyjny}</strong>. Agent skontaktuje się
            z Tobą w sprawie oferty. Jeśli chcesz coś zmienić, napisz do swojego agenta.
          </p>
          <a href={`/api/wniosek/${token}/excel`} className="przycisk-drugi mt-6">
            Pobierz kopię wniosku (.xlsx)
          </a>
        </div>
      </main>
    );
  }

  return (
    <KreatorWniosku
      token={token}
      wartosciPoczatkowe={wynik.dane}
      zImportu={zrodlo === "excel"}
      nrReferencyjny={wynik.meta.nr_referencyjny}
    />
  );
}
