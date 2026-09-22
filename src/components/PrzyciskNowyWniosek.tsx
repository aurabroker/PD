"use client";

import { useState, useTransition } from "react";
import { akcjaNowyWniosek } from "@/app/actions/wniosek";

/**
 * Start nowego wniosku. Komponent kliencki, bo przy niepowodzeniu ma pokazac
 * powod - zwykly `<form action={...}>` na serwerze konczylby sie pustym 500.
 */
export default function PrzyciskNowyWniosek() {
  const [oczekuje, startTransition] = useTransition();
  const [blad, setBlad] = useState("");

  function rozpocznij() {
    setBlad("");
    startTransition(async () => {
      // Przy powodzeniu akcja przekierowuje i nic tu nie wraca.
      const wynik = await akcjaNowyWniosek();
      if (wynik && !wynik.ok) setBlad(wynik.blad);
    });
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={rozpocznij} disabled={oczekuje} className="przycisk-glowny w-full">
        {oczekuje ? "Przygotowuję wniosek…" : "Rozpocznij wniosek"}
      </button>
      {blad && <p className="mt-2 text-xs text-red-600">{blad}</p>}
    </div>
  );
}
