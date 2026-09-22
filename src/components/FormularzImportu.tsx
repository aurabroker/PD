"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { akcjaImportujExcel } from "@/app/actions/wniosek";
import type { OstrzezenieImportu } from "@/lib/excel/parse";

export default function FormularzImportu() {
  const router = useRouter();
  const [oczekuje, startTransition] = useTransition();
  const [blad, setBlad] = useState("");
  const [ostrzezenia, setOstrzezenia] = useState<OstrzezenieImportu[] | null>(null);
  const [token, setToken] = useState("");

  function wyslij(formData: FormData) {
    setBlad("");
    setOstrzezenia(null);

    startTransition(async () => {
      const wynik = await akcjaImportujExcel(formData);

      if (!wynik.ok) {
        setBlad(wynik.blad);
        return;
      }

      // Ostrzezenia warto pokazac przed przejsciem dalej - inaczej klient ich nie zobaczy.
      if (wynik.ostrzezenia.length > 0) {
        setOstrzezenia(wynik.ostrzezenia);
        setToken(wynik.token);
        return;
      }

      router.push(`/wniosek/${wynik.token}?zrodlo=excel`);
    });
  }

  if (ostrzezenia) {
    return (
      <div className="mt-4">
        <p className="text-sm font-medium text-amber-800">
          Plik wczytany, ale {ostrzezenia.length}{" "}
          {ostrzezenia.length === 1 ? "pozycja wymaga" : "pozycji wymaga"} uwagi:
        </p>
        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {ostrzezenia.map((o, i) => (
            <li key={i}>
              <span className="font-medium">{o.arkusz}</span> — {o.opis}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => router.push(`/wniosek/${token}?zrodlo=excel`)}
          className="przycisk-glowny mt-4 w-full"
        >
          Przejdź do wniosku i popraw
        </button>
      </div>
    );
  }

  return (
    <form action={wyslij} className="mt-6 space-y-3">
      <input
        type="file"
        name="plik"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        className="block w-full text-sm text-stone-600
                   file:mr-3 file:rounded-lg file:border-0 file:bg-marka-100
                   file:px-4 file:py-2 file:text-sm file:font-medium file:text-marka-900
                   hover:file:bg-marka-200"
      />
      {blad && <p className="text-xs text-red-600">{blad}</p>}
      <button type="submit" disabled={oczekuje} className="przycisk-drugi w-full">
        {oczekuje ? "Wczytuję…" : "Wczytaj wniosek z pliku"}
      </button>
    </form>
  );
}
