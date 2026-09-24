/**
 * Slowniki przepisane 1:1 z arkusza `_listy` szablonu Excel.
 * Wartosci musza sie zgadzac co do znaku, bo import pliku porownuje je doslownie.
 */

export const FORMA_PRAWNA = [
  "Jednoosobowa działalność gospodarcza",
  "Spółka cywilna",
  "Spółka z o.o.",
  "Spółka akcyjna",
  "Spółka jawna",
  "Spółka komandytowa",
  "Inne",
] as const;

export const LICZBA_PRACOWNIKOW = ["1", "2–5", "6–10", "11–25", "26–50", "51+"] as const;

export const ROCZNY_OBROT = [
  "do 200 tys. PLN",
  "200–500 tys. PLN",
  "500 tys. – 1 mln PLN",
  "1–3 mln PLN",
  "powyżej 3 mln PLN",
] as const;

export const TYP_LOKALU = [
  "Lokal usługowy",
  "Budynek wolnostojący",
  "Lokal w centrum handlowym",
  "Dom jednorodzinny",
  "Inny",
] as const;

export const MATERIAL_SCIAN = [
  "Cegła / mur",
  "Żelbet / beton",
  "Drewno / szkielet drewniany",
  "Gazobeton / bloczki",
  "Inne",
] as const;

export const POKRYCIE_DACHU = [
  "Papa / asfalt",
  "Dachówka ceramiczna",
  "Blacha trapezowa / panele",
  "Strop żelbetowy (flat)",
  "Inne",
] as const;

export const STAN_TECHNICZNY = ["Bardzo dobry", "Dobry", "Dostateczny", "Wymaga remontu"] as const;

export const OGRZEWANIE = [
  "Centralne (sieciowe)",
  "Gazowe",
  "Elektryczne",
  "Olejowe",
  "Pompą ciepła",
  "Inne",
] as const;

export const ALARM_TYP = [
  "brak",
  "Lokalny (sygnał dźwiękowy)",
  "Monitoring przez stację (SMS)",
  "Monitoring przez agencję ochrony",
] as const;

export const SEJF_KLASA = ["brak", "I", "II", "III", "IV+"] as const;

/**
 * Zakres ubezpieczenia. Kolumna `zakres` w bazie trzyma tablice tych etykiet
 * (tak zapisaly je wnioski zlozone przed ta aplikacja), wiec brzmienie jest znaczace.
 */
export const ZAKRES = [
  "Mienie od ognia i zdarzeń losowych",
  "Szyby i inne przedmioty",
  "Dewastacja / wandalizm",
  "Przepięcia elektryczne",
  "Kradzież z włamaniem i rabunek",
  "Sprzęt elektroniczny (EEI)",
  "Sprzęt medyczny / aparatura",
] as const;

/**
 * Inne brzmienia tych samych pozycji zakresu spotykane w szablonach Excel.
 * Kanoniczna jest wartosc z `ZAKRES` - tak zapisaly zakres wnioski zlozone
 * przed ta aplikacja i tak ma zostac w bazie.
 */
export const ZAKRES_ALIASY: Record<string, (typeof ZAKRES)[number]> = {
  "Szyby i inne przedmioty od stłuczenia": "Szyby i inne przedmioty",
  "Szyby i przedmioty szklane": "Szyby i inne przedmioty",
  "Mienie od ognia": "Mienie od ognia i zdarzeń losowych",
  "Kradzież z włamaniem": "Kradzież z włamaniem i rabunek",
  "Sprzęt elektroniczny": "Sprzęt elektroniczny (EEI)",
  "Sprzęt medyczny": "Sprzęt medyczny / aparatura",
  "Sprzęt medyczny / estetyczny": "Sprzęt medyczny / aparatura",
};

/** Pozycje zakresu bedace skladowa "Mienia od ognia" - w UI pokazywane jako podpunkty. */
export const ZAKRES_SKLADOWE_OGNIA = [
  "Szyby i inne przedmioty",
  "Dewastacja / wandalizm",
  "Przepięcia elektryczne",
] as const;

export const STATUS = [
  "roboczy",
  "zlozony",
  "w_ocenie",
  "wyceniony",
  "zaakceptowany",
  "polisa",
  "rezygnacja",
  "odrzucony",
  "archiwalny",
] as const;

export type Status = (typeof STATUS)[number];

/**
 * Lejek: roboczy → złożony → w ocenie → oferta → akceptacja → polisa.
 * Wyjścia z lejka: rezygnacja klienta, odrzucenie (odmowa TU/agenta), archiwum.
 */
export const STATUS_ETYKIETY: Record<Status, string> = {
  roboczy: "Roboczy",
  zlozony: "Złożony",
  w_ocenie: "W ocenie",
  wyceniony: "Oferta przedstawiona",
  zaakceptowany: "Oferta zaakceptowana",
  polisa: "Polisa zawarta",
  rezygnacja: "Rezygnacja klienta",
  odrzucony: "Odrzucony",
  archiwalny: "Archiwalny",
};

/** Kolory znacznika statusu (Tailwind). */
export const STATUS_KOLORY: Record<Status, string> = {
  roboczy: "bg-stone-100 text-stone-600",
  zlozony: "bg-blue-50 text-blue-700",
  w_ocenie: "bg-amber-50 text-amber-800",
  wyceniony: "bg-violet-50 text-violet-700",
  zaakceptowany: "bg-teal-50 text-teal-700",
  polisa: "bg-emerald-50 text-emerald-700",
  rezygnacja: "bg-orange-50 text-orange-700",
  odrzucony: "bg-red-50 text-red-700",
  archiwalny: "bg-stone-100 text-stone-400",
};

/** Statusy „w toku” — wniosek czeka na ruch agenta albo klienta. */
export const STATUSY_OTWARTE: readonly Status[] = ["zlozony", "w_ocenie", "wyceniony", "zaakceptowany"];

/** Statusy, w których oferta została już przedstawiona klientowi. */
export const STATUSY_Z_OFERTA: readonly Status[] = ["wyceniony", "zaakceptowany", "polisa"];

export const POWODY_REZYGNACJI = [
  "Za wysoka składka",
  "Wybór oferty innego pośrednika",
  "Przedłużenie obecnej polisy",
  "Brak kontaktu z klientem",
  "Rezygnacja z ubezpieczenia",
  "Inny powód",
] as const;

/** Pozycje sum ubezpieczenia - wspolna kolejnosc dla formularza, Excela i podsumowania. */
export const POZYCJE_SUM = [
  { klucz: "suma_budynek", etykieta: "Budynek / nakłady adaptacyjne (najemcy)" },
  { klucz: "suma_wyposazenie", etykieta: "Wyposażenie stałe (meble, zabudowa)" },
  { klucz: "suma_maszyny", etykieta: "Maszyny i urządzenia produkcyjne" },
  { klucz: "suma_srodki_obrotowe", etykieta: "Środki obrotowe (towary, kosmetyki, preparaty)" },
  { klucz: "suma_elektronika_it", etykieta: "Sprzęt elektroniczny (IT, kasy fiskalne)" },
  { klucz: "suma_sprzet_medyczny", etykieta: "Sprzęt medyczny / estetyczny" },
  { klucz: "suma_gotowka_lokal", etykieta: "Gotówka w lokalu (max jednorazowo)" },
  { klucz: "suma_gotowka_transport", etykieta: "Gotówka w transporcie (max jednorazowo)" },
  { klucz: "suma_szyby", etykieta: "Szyby i inne przedmioty od stłuczenia" },
  { klucz: "suma_mienie_pracownikow", etykieta: "Mienie pracowników" },
] as const;

export type KluczSumy = (typeof POZYCJE_SUM)[number]["klucz"];
