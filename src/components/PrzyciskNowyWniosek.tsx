"use client";

import { useCallback, useState, useTransition } from "react";
import { akcjaNowyWniosek } from "@/app/actions/wniosek";
import Turnstile from "@/components/Turnstile";
import { TURNSTILE_WLACZONY } from "@/lib/turnstile-config";

/**
 * Start nowego wniosku. Komponent kliencki, bo przy niepowodzeniu ma pokazac
 * powod - zwykly `<form action={...}>` na serwerze konczylby sie pustym 500.
 */
export default function PrzyciskNowyWniosek() {
  const [oczekuje, startTransition] = useTransition();
  const [blad, setBlad] = useState("");
  const [token, setToken] = useState("");
  const onToken = useCallback((t: string) => setToken(t), []);

  const gotowe = !TURNSTILE_WLACZONY || Boolean(token);

  function rozpocznij() {
    setBlad("");
    startTransition(async () => {
      // Przy powodzeniu akcja przekierowuje i nic tu nie wraca.
      const wynik = await akcjaNowyWniosek(token);
      if (wynik && !wynik.ok) setBlad(wynik.blad);
    });
  }

  return (
    <div className="mt-6">
      <Turnstile onToken={onToken} />
      <button
        type="button"
        onClick={rozpocznij}
        disabled={oczekuje || !gotowe}
        className="przycisk-glowny mt-3 w-full"
      >
        {oczekuje ? "Przygotowuję wniosek…" : "Rozpocznij wniosek"}
      </button>
      {blad && <p className="mt-2 text-xs text-red-600">{blad}</p>}
    </div>
  );
}
