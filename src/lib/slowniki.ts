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
  "odrzucony",
  "archiwalny",
] as const;

export const STATUS_ETYKIETY: Record<(typeof STATUS)[number], string> = {
  roboczy: "Roboczy",
  zlozony: "Złożony",
  w_ocenie: "W ocenie",
  wyceniony: "Wyceniony",
  zaakceptowany: "Zaakceptowany",
  odrzucony: "Odrzucony",
  archiwalny: "Archiwalny",
};

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
