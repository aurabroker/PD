"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIMITY_PODPISU,
  PROPORCJE_PODPISU,
  wystarczajacyPodpis,
  type Podpis,
  type Punkt,
} from "@/lib/podpis-wspolne";

/**
 * Podpis wnioskodawcy palcem, rysikiem albo myszą.
 *
 * Pole otwiera się w oknie na cały ekran — na telefonie to jedyny sposób, żeby
 * mieć miejsce na podpis i żeby przeciąganie palcem nie przewijało strony.
 * Zapisujemy obraz PNG (do PDF) i przebieg ruchu ręki (punkty, czas, nacisk
 * rysika) jako ślad dowodowy. Proporcje pola są stałe, więc obrót telefonu
 * nie zniekształca podpisu.
 */

const ATRAMENT = "#0b2545";
/** Grubość linii jako ułamek szerokości pola — taka sama na ekranie i w PNG. */
const GRUBOSC = 0.0055;
const PNG_SZEROKOSC = 1000;

function rysuj(ctx: CanvasRenderingContext2D, kreski: Punkt[][], szer: number, wys: number, rysik: boolean[]) {
  ctx.clearRect(0, 0, szer, wys);
  ctx.strokeStyle = ATRAMENT;
  ctx.fillStyle = ATRAMENT;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  kreski.forEach((kreska, k) => {
    const pkt = kreska.map(([x, y, , p]) => ({ x: x * szer, y: y * wys, p }));
    const grubosc = (p: number) => szer * GRUBOSC * (rysik[k] ? 0.55 + 0.9 * p : 1);
    if (pkt.length === 1) {
      ctx.beginPath();
      ctx.arc(pkt[0].x, pkt[0].y, grubosc(pkt[0].p) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // Wygładzanie: krzywe przez środki kolejnych odcinków.
    for (let i = 1; i < pkt.length; i++) {
      const a = pkt[i - 1];
      const b = pkt[i];
      const poprzedniSrodek = i > 1 ? { x: (pkt[i - 2].x + a.x) / 2, y: (pkt[i - 2].y + a.y) / 2 } : a;
      const srodek = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctx.beginPath();
      ctx.lineWidth = grubosc((a.p + b.p) / 2);
      ctx.moveTo(poprzedniSrodek.x, poprzedniSrodek.y);
      ctx.quadraticCurveTo(a.x, a.y, srodek.x, srodek.y);
      if (i === pkt.length - 1) ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  });
}

function doPng(kreski: Punkt[][], rysik: boolean[]): string {
  const c = document.createElement("canvas");
  c.width = PNG_SZEROKOSC;
  c.height = Math.round(PNG_SZEROKOSC / PROPORCJE_PODPISU);
  rysuj(c.getContext("2d")!, kreski, c.width, c.height, rysik);
  return c.toDataURL("image/png");
}

export default function PolePodpisu({
  wartosc,
  onZmiana,
  blad,
}: {
  wartosc: Podpis | null;
  onZmiana: (p: Podpis | null) => void;
  blad?: string;
}) {
  const [otwarte, setOtwarte] = useState(false);

  return (
    <div>
      <p className="etykieta">
        Podpis wnioskodawcy<span className="ml-0.5 text-marka-600">*</span>
      </p>
      {wartosc ? (
        <div className="rounded-lg border border-stone-300 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- podgląd podpisu (data URL) */}
          <img src={wartosc.png} alt="Twój podpis" className="mx-auto h-24 w-auto" />
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-100 pt-2">
            <span className="text-xs text-stone-500">Podpis trafi do PDF wniosku.</span>
            <button type="button" className="text-sm font-medium text-marka-700 hover:text-marka-900" onClick={() => setOtwarte(true)}>
              Podpisz ponownie
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOtwarte(true)}
          className={`flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-white text-stone-600 transition hover:border-marka-400 hover:text-marka-700 ${
            blad ? "border-red-400" : "border-stone-300"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
            <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              d="M3 17c3-4 5-9 7-9s0 9 2 9 3-5 5-5 1 4 4 4M3 21h18" />
          </svg>
          <span className="text-sm font-medium">Podpisz wniosek</span>
          <span className="text-xs text-stone-500">palcem, rysikiem lub myszą</span>
        </button>
      )}
      {blad && <p className="komunikat-bledu">{blad}</p>}
      {otwarte && (
        <OknoPodpisu
          onAnuluj={() => setOtwarte(false)}
          onZatwierdz={(p) => {
            onZmiana(p);
            setOtwarte(false);
          }}
        />
      )}
    </div>
  );
}

function OknoPodpisu({ onAnuluj, onZatwierdz }: { onAnuluj: () => void; onZatwierdz: (p: Podpis) => void }) {
  const ramka = useRef<HTMLDivElement>(null);
  const plotno = useRef<HTMLCanvasElement>(null);
  const kreski = useRef<Punkt[][]>([]);
  const rysik = useRef<boolean[]>([]);
  const start = useRef<number | null>(null);
  const aktywny = useRef<number | null>(null);
  const [wymiary, setWymiary] = useState({ szer: 0, wys: 0 });
  const [pusto, setPusto] = useState(true);
  const [zaKrotki, setZaKrotki] = useState(false);
  const [pionowo, setPionowo] = useState(false);

  // Pole o stałych proporcjach, jak największe w dostępnym miejscu.
  useEffect(() => {
    const dopasuj = () => {
      const r = ramka.current;
      if (!r) return;
      const { width, height } = r.getBoundingClientRect();
      const szer = Math.floor(Math.min(width, height * PROPORCJE_PODPISU));
      setWymiary({ szer, wys: Math.floor(szer / PROPORCJE_PODPISU) });
      setPionowo(window.innerHeight > window.innerWidth && window.innerWidth < 640);
    };
    dopasuj();
    const obserwator = new ResizeObserver(dopasuj);
    if (ramka.current) obserwator.observe(ramka.current);
    window.addEventListener("orientationchange", dopasuj);
    return () => {
      obserwator.disconnect();
      window.removeEventListener("orientationchange", dopasuj);
    };
  }, []);

  const odswiez = useCallback(() => {
    const c = plotno.current;
    if (!c || !wymiary.szer) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(wymiary.szer * dpr);
    c.height = Math.round(wymiary.wys * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rysuj(ctx, kreski.current, wymiary.szer, wymiary.wys, rysik.current);
  }, [wymiary]);

  useEffect(odswiez, [odswiez]);

  // Okno modalne: blokada przewijania strony pod spodem, Esc zamyka.
  useEffect(() => {
    const poprzednie = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const klawisz = (e: KeyboardEvent) => e.key === "Escape" && onAnuluj();
    window.addEventListener("keydown", klawisz);
    return () => {
      document.body.style.overflow = poprzednie;
      window.removeEventListener("keydown", klawisz);
    };
  }, [onAnuluj]);

  const punktZ = (e: PointerEvent | React.PointerEvent): Punkt => {
    const r = plotno.current!.getBoundingClientRect();
    if (start.current === null) start.current = e.timeStamp;
    const zaokr = (v: number, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
    return [
      zaokr((e.clientX - r.left) / r.width),
      zaokr((e.clientY - r.top) / r.height),
      Math.max(0, Math.round(e.timeStamp - start.current)),
      zaokr(e.pointerType === "pen" ? e.pressure : 0.5, 2),
    ];
  };

  const liczbaPunktow = () => kreski.current.reduce((a, k) => a + k.length, 0);

  const dol = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (aktywny.current !== null || kreski.current.length >= LIMITY_PODPISU.kresek) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    aktywny.current = e.pointerId;
    kreski.current.push([punktZ(e)]);
    rysik.current.push(e.pointerType === "pen");
    setPusto(false);
    setZaKrotki(false);
    odswiez();
  };

  const ruch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (aktywny.current !== e.pointerId) return;
    e.preventDefault();
    const zdarzenia = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const kreska = kreski.current[kreski.current.length - 1];
    for (const z of zdarzenia) {
      if (liczbaPunktow() >= LIMITY_PODPISU.punktow) break;
      kreska.push(punktZ(z));
    }
    odswiez();
  };

  const gora = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (aktywny.current === e.pointerId) aktywny.current = null;
  };

  const wyczysc = () => {
    kreski.current = [];
    rysik.current = [];
    start.current = null;
    setPusto(true);
    setZaKrotki(false);
    odswiez();
  };

  const zatwierdz = () => {
    if (!wystarczajacyPodpis(kreski.current)) {
      setZaKrotki(true);
      return;
    }
    onZatwierdz({
      png: doPng(kreski.current, rysik.current),
      punkty: kreski.current.map((k) => k.slice()),
      proporcje: PROPORCJE_PODPISU,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Podpis wnioskodawcy"
      // Wyśrodkowane okno tylko na dużym ekranie; telefon (także poziomo) — cały ekran,
      // inaczej przy niskim ekranie przyciski wychodziły poza widok.
      className="fixed inset-0 z-50 flex bg-stone-900/70 [@media(min-width:640px)_and_(min-height:560px)]:items-center [@media(min-width:640px)_and_(min-height:560px)]:justify-center [@media(min-width:640px)_and_(min-height:560px)]:p-6"
    >
      <div className="flex h-[100dvh] w-full flex-col bg-white [@media(min-width:640px)_and_(min-height:560px)]:h-auto [@media(min-width:640px)_and_(min-height:560px)]:max-w-3xl [@media(min-width:640px)_and_(min-height:560px)]:rounded-xl [@media(min-width:640px)_and_(min-height:560px)]:shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div>
            <p className="text-base font-semibold text-stone-900">Podpisz wniosek</p>
            <p className="text-xs text-stone-500">Palcem, rysikiem lub myszą — tak jak na papierze.</p>
          </div>
          <button type="button" onClick={onAnuluj} className="text-sm text-stone-500 hover:text-stone-800">
            Anuluj
          </button>
        </div>

        {pionowo && (
          <p className="bg-marka-50 px-4 py-2 text-center text-xs text-marka-900">
            Obróć telefon poziomo — będzie więcej miejsca na podpis.
          </p>
        )}

        <div ref={ramka} className="flex min-h-0 flex-1 items-center justify-center p-3 [@media(min-width:640px)_and_(min-height:560px)]:h-[340px] [@media(min-width:640px)_and_(min-height:560px)]:flex-none">
          {wymiary.szer > 0 && (
            <div className="relative" style={{ width: wymiary.szer, height: wymiary.wys }}>
              <canvas
                ref={plotno}
                aria-label="Pole podpisu"
                data-pole-podpisu=""
                onPointerDown={dol}
                onPointerMove={ruch}
                onPointerUp={gora}
                onPointerCancel={gora}
                className="absolute inset-0 h-full w-full cursor-crosshair rounded-lg border border-stone-300 bg-white"
                style={{ touchAction: "none" }}
              />
              <div className="pointer-events-none absolute inset-x-[6%] bottom-[22%] border-b border-dashed border-stone-300" />
              {pusto && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">
                  Podpisz się tutaj
                </span>
              )}
            </div>
          )}
        </div>

        {zaKrotki && (
          <p className="px-4 text-center text-sm text-red-600">Podpis jest za krótki — podpisz się tak jak na papierze.</p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
          <button type="button" onClick={wyczysc} className="przycisk-drugi" disabled={pusto}>
            Wyczyść
          </button>
          <button type="button" onClick={zatwierdz} className="przycisk-glowny" disabled={pusto}>
            Zatwierdź podpis
          </button>
        </div>
      </div>
    </div>
  );
}
