"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type StanZdrowia = "sprawdzam" | "ok" | "blad" | "nieznany";

/**
 * Zakładki panelu. „Health” świeci na zielono albo czerwono — stan pobieramy
 * po stronie przeglądarki, żeby wolna integracja (GUS, Resend) nie opóźniała
 * wczytania żadnej strony panelu. Odświeżenie co 5 minut.
 */
export default function NawigacjaPanelu({ admin }: { admin: boolean }) {
  const sciezka = usePathname();
  const [zdrowie, setZdrowie] = useState<StanZdrowia>("sprawdzam");
  const [bledy, setBledy] = useState<string[]>([]);

  useEffect(() => {
    if (!admin) return;
    let aktywny = true;
    const pobierz = () =>
      fetch("/api/admin/health", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { stan: "ok" | "blad"; bledy: string[] }) => {
          if (!aktywny) return;
          setZdrowie(d.stan);
          setBledy(d.bledy ?? []);
        })
        .catch(() => aktywny && setZdrowie("nieznany"));
    pobierz();
    const co5min = setInterval(pobierz, 5 * 60 * 1000);
    return () => {
      aktywny = false;
      clearInterval(co5min);
    };
  }, [admin]);

  const aktywna = (href: string) =>
    href === "/admin" ? sciezka === "/admin" || sciezka.startsWith("/admin/wnioski") : sciezka.startsWith(href);

  const klasa = (href: string) =>
    `rounded-md px-3 py-1.5 font-medium transition ${
      aktywna(href) ? "bg-marka-50 text-marka-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
    }`;

  const wygladZdrowia: Record<StanZdrowia, { ikona: string; klasa: string; opis: string }> = {
    sprawdzam: { ikona: "…", klasa: "text-stone-400", opis: "Sprawdzam stan systemu" },
    ok: { ikona: "●", klasa: "text-emerald-600", opis: "Wszystko działa" },
    blad: { ikona: "●", klasa: "text-red-600", opis: `Wymaga interwencji: ${bledy.join(", ")}` },
    nieznany: { ikona: "?", klasa: "text-amber-600", opis: "Nie udało się pobrać stanu systemu" },
  };
  const z = wygladZdrowia[zdrowie];

  return (
    <nav className="flex flex-wrap gap-1 text-sm" aria-label="Zakładki panelu">
      <a href="/admin" className={klasa("/admin")}>Panel agenta</a>
      {admin && (
        <a
          href="/admin/health"
          className={`${klasa("/admin/health")} flex items-center gap-1.5`}
          title={z.opis}
          data-stan-zdrowia={zdrowie}
        >
          <span className={`text-[10px] leading-none ${z.klasa}`} aria-hidden>{z.ikona}</span>
          <span className={zdrowie === "blad" ? "font-semibold text-red-700" : zdrowie === "ok" ? "text-emerald-700" : ""}>
            Health
          </span>
          <span className="sr-only">— {z.opis}</span>
        </a>
      )}
      <a href="/admin/statystyki" className={klasa("/admin/statystyki")}>Statystyki</a>
      {admin && <a href="/admin/agenci" className={klasa("/admin/agenci")}>Agenci</a>}
    </nav>
  );
}
