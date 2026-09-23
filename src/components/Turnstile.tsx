"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITEKEY } from "@/lib/turnstile-config";

/**
 * Widget Cloudflare Turnstile. Wola `onToken` z tokenem po rozwiazaniu wyzwania,
 * a z pustym stringiem przy bledzie lub wygasnieciu (token jednorazowy).
 * Gdy site key jest pusty, nie renderuje nic — formularze dzialaja jak wczesniej.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opcje: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

function zaladujSkrypt(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject();
    if (window.turnstile) return resolve();
    const istniejacy = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (istniejacy) {
      istniejacy.addEventListener("load", () => resolve());
      istniejacy.addEventListener("error", () => reject());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-turnstile", "");
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idWidgetu = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITEKEY || !ref.current) return;
    let anulowane = false;

    zaladujSkrypt()
      .then(() => {
        if (anulowane || !ref.current || !window.turnstile) return;
        idWidgetu.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (t: string) => onToken(t),
          "error-callback": () => onToken(""),
          "expired-callback": () => onToken(""),
        });
      })
      .catch(() => {
        // Skrypt sie nie zaladowal (np. offline) — nie blokujemy interfejsu.
      });

    return () => {
      anulowane = true;
      if (idWidgetu.current && window.turnstile) {
        try {
          window.turnstile.remove(idWidgetu.current);
        } catch {
          // widget mogl juz zniknac
        }
        idWidgetu.current = null;
      }
    };
  }, [onToken]);

  if (!TURNSTILE_SITEKEY) return null;
  return <div ref={ref} className="mt-4" />;
}
