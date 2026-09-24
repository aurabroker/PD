/**
 * Dane dystrybutora — z dokumentu „Informacje dotyczące agenta ubezpieczeniowego”
 * (public/dokumenty/aura-expert-informacja-o-dystrybutorze.pdf, lipiec 2026).
 * Jedno źródło dla stopki maila i kopii wniosku w PDF. Zmiana danych firmy =
 * zmiana tutaj ORAZ podmiana dokumentów PDF w public/dokumenty/.
 */
export const DYSTRYBUTOR = {
  nazwa: "Aura Expert sp. z o.o.",
  forma: "agent ubezpieczeniowy",
  adres: "ul. Bolkowska 2A/28, 01-466 Warszawa",
  email: "zarzad@auraexpert.pl",
  telefon: "+48 504 400 901",
  krs: "0000599840",
  nip: "5242793544",
  regon: "363673048",
  knf: "11229690/A",
  rejestrKnf: "https://rpu.knf.gov.pl",
  reklamacje: "reklamacje@auraexpert.pl",
  iod: "iod@auraexpert.pl",
} as const;

export const DOKUMENTY = {
  dystrybutor: { plik: "aura-expert-informacja-o-dystrybutorze.pdf", nazwa: "Informacja o dystrybutorze — Aura Expert.pdf" },
  rodo: { plik: "aura-expert-nota-rodo.pdf", nazwa: "Nota informacyjna RODO — Aura Expert.pdf" },
} as const;

/** Oświadczenia z formularza — tą samą treścią w formularzu i w kopii PDF. */
export const TRESC_ZGODY = {
  prawdziwosc:
    "Oświadczam, że wszystkie informacje podane we wniosku są zgodne z prawdą i odzwierciedlają rzeczywisty stan faktyczny.",
  rodo: "Wyrażam zgodę na przetwarzanie moich danych osobowych przez Aura Expert sp. z o.o. w celu przygotowania oferty ubezpieczenia, zgodnie z RODO.",
} as const;
