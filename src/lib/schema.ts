/**
 * Zrodlo prawdy dla calej aplikacji.
 *
 * Ten sam schemat waliduje dane z formularza web i dane wyciagniete z pliku Excel,
 * dzieki czemu oba kanaly produkuja identyczny obiekt i trafiaja w jedna funkcje zapisu.
 * Kazda zmiana pola zaczyna sie tutaj.
 */
import { z } from "zod";
import {
  ALARM_TYP,
  FORMA_PRAWNA,
  LICZBA_PRACOWNIKOW,
  MATERIAL_SCIAN,
  OGRZEWANIE,
  POKRYCIE_DACHU,
  ROCZNY_OBROT,
  SEJF_KLASA,
  STAN_TECHNICZNY,
  TYP_LOKALU,
  ZAKRES,
} from "./slowniki";

/** Pole slownikowe: akceptuje pusta wartosc (klient nie musi wybrac) albo wartosc z listy. */
const zeSlownika = <T extends readonly [string, ...string[]]>(lista: T) =>
  z.union([z.enum(lista), z.literal("")]).default("");

/** Kwota w pelnych zlotych. Puste pole i 0 sa rownowazne. */
const kwota = z.coerce
  .number({ invalid_type_error: "Podaj kwotę liczbą" })
  .min(0, "Kwota nie może być ujemna")
  .max(1_000_000_000, "Kwota wygląda na zawyżoną")
  .default(0);

const tekst = z.string().trim().default("");

/** NIP: 10 cyfr, z suma kontrolna. Puste pole przechodzi - NIP nie jest wymagany. */
const nip = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^\d{10}$/.test(v.replace(/[\s-]/g, "")), {
    message: "NIP musi mieć 10 cyfr",
  })
  .refine(
    (v) => {
      const cyfry = v.replace(/[\s-]/g, "");
      if (cyfry === "") return true;
      if (!/^\d{10}$/.test(cyfry)) return true; // komunikat obsluzony wyzej
      const wagi = [6, 5, 7, 2, 3, 4, 5, 6, 7];
      const suma = wagi.reduce((acc, w, i) => acc + w * Number(cyfry[i]), 0);
      return suma % 11 === Number(cyfry[9]);
    },
    { message: "NIP ma niepoprawną sumę kontrolną" },
  );

export const urzadzenieMedyczneSchema = z.object({
  lokalizacja: z.coerce.number().int().min(1).max(3).default(1),
  nazwa: tekst,
  producent: tekst,
  model: tekst,
  nr_seryjny: tekst,
  rok_zakupu: tekst,
  wartosc: kwota,
  cert_ce: z.boolean().default(false),
  uwagi: tekst,
});

export const urzadzenieEeiSchema = z.object({
  lokalizacja: z.coerce.number().int().min(1).max(3).default(1),
  nazwa: tekst,
  producent: tekst,
  model: tekst,
  rok_zakupu: tekst,
  wartosc: kwota,
  nr_seryjny: tekst,
  uwagi: tekst,
});

export const szkodaSchema = z.object({
  data: tekst,
  przyczyna: tekst,
  kwota_szkody: kwota,
  odszkodowanie: kwota,
  ubezpieczyciel: tekst,
});

export const lokalizacjaSchema = z.object({
  nr: z.coerce.number().int().min(1).max(3).default(1),
  nazwa: tekst,
  adres: tekst,
  typ_lokalu: zeSlownika(TYP_LOKALU),
  pietro: tekst,
  powierzchnia: z.coerce.number().min(0).max(100000).nullable().default(null),
  rok_budowy: tekst,
  rok_remontu: tekst,
  material_scian: zeSlownika(MATERIAL_SCIAN),
  pokrycie_dachu: zeSlownika(POKRYCIE_DACHU),
  stan_techniczny: zeSlownika(STAN_TECHNICZNY),
  ogrzewanie: zeSlownika(OGRZEWANIE),
  budynek_wlasny: z.boolean().default(false),
  materialy_palne: z.boolean().default(false),

  // Sekcja 4A - zabezpieczenia przeciwpozarowe
  gasnice_szt: tekst,
  data_przegladu_gasnic: tekst,
  odleglosc_psp: tekst,
  hydranty: z.boolean().default(false),
  sap: z.boolean().default(false),
  tryskacze: z.boolean().default(false),
  drogi_ewakuacyjne: z.boolean().default(false),
  zakaz_palenia: z.boolean().default(false),

  // Sekcja 4B - zabezpieczenia antykradziezowe
  alarm_typ: zeSlownika(ALARM_TYP),
  agencja_ochrony: tekst,
  sejf_klasa: zeSlownika(SEJF_KLASA),
  ogrodzenie: z.boolean().default(false),
  agencja_24h: z.boolean().default(false),
  cctv: z.boolean().default(false),
  kraty: z.boolean().default(false),
  rolety: z.boolean().default(false),
  zamki_atestowane: z.boolean().default(false),
  drzwi_atestowane: z.boolean().default(false),
  szyby_antywlamaniowe: z.boolean().default(false),
  system_alarmowy: z.boolean().default(false),

  // Sumy ubezpieczenia dla lokalizacji
  suma_budynek: kwota,
  suma_wyposazenie: kwota,
  suma_maszyny: kwota,
  suma_srodki_obrotowe: kwota,
  suma_elektronika_it: kwota,
  suma_sprzet_medyczny: kwota,
  suma_gotowka_lokal: kwota,
  suma_gotowka_transport: kwota,
  suma_szyby: kwota,
  suma_mienie_pracownikow: kwota,
});

export const wniosekSchema = z.object({
  // Sekcja 1 - dane ubezpieczajacego
  nazwa_firmy: z.string().trim().min(1, "Podaj nazwę firmy lub imię i nazwisko"),
  nip,
  regon: tekst,
  krs: tekst,
  adres_siedziby: z.string().trim().min(1, "Podaj adres siedziby"),
  forma_prawna: zeSlownika(FORMA_PRAWNA),
  numer_pkd: tekst,
  email_kontaktowy: z.string().trim().email("Podaj poprawny adres e-mail"),
  telefon: z.string().trim().min(1, "Podaj numer telefonu"),
  osoba_kontaktu: tekst,
  stanowisko: tekst,

  // Sekcja 3 - profil dzialalnosci
  rodzaj_dzialalnosci: z.string().trim().min(1, "Opisz rodzaj działalności"),
  liczba_pracownikow: zeSlownika(LICZBA_PRACOWNIKOW),
  roczny_obrot: zeSlownika(ROCZNY_OBROT),
  zabiegi: z.array(z.string()).default([]),

  // Sekcje 2 i 4 - lokalizacje (min. 1, max 3 jak w szablonie Excel)
  lokalizacje: z.array(lokalizacjaSchema).min(1, "Wypełnij co najmniej jedną lokalizację").max(3),

  // Sekcja 5 - zakres
  zakres: z.array(z.enum(ZAKRES)).default([]),

  // Wykazy sprzetu (przypisane do lokalizacji przez pole `lokalizacja`)
  sprzet_medyczny: z.array(urzadzenieMedyczneSchema).default([]),
  elektronika_eei: z.array(urzadzenieEeiSchema).default([]),

  // Sekcja 7 - szkodowosc
  brak_szkod: z.boolean().default(true),
  szkody: z.array(szkodaSchema).default([]),

  // Sekcja 8 - dotychczasowa polisa
  posiada_polise: z.boolean().default(false),
  towarzystwo_obecne: tekst,
  nr_polisy_obecny: tekst,
  waznosc_do: tekst,
  roczna_skladka_obecna: z.coerce.number().min(0).nullable().default(null),

  // Sekcja 9 - uwagi i oswiadczenia
  uwagi: tekst,
  miejscowosc_podpisu: tekst,
  data_podpisu: tekst,
  zgoda_prawdziwosc: z.boolean().default(false),
  zgoda_rodo: z.boolean().default(false),
});

export type Wniosek = z.infer<typeof wniosekSchema>;
export type Lokalizacja = z.infer<typeof lokalizacjaSchema>;
export type UrzadzenieMedyczne = z.infer<typeof urzadzenieMedyczneSchema>;
export type UrzadzenieEei = z.infer<typeof urzadzenieEeiSchema>;
export type Szkoda = z.infer<typeof szkodaSchema>;

/**
 * Walidacja przy zlozeniu wniosku - ostrzejsza niz przy zapisie roboczym.
 * Wersja robocza ma prawo byc niekompletna, zlozona nie.
 */
export const wniosekDoZlozeniaSchema = wniosekSchema
  .extend({
    zgoda_prawdziwosc: z.literal(true, {
      errorMap: () => ({ message: "Potwierdź prawdziwość podanych informacji" }),
    }),
    zgoda_rodo: z.literal(true, {
      errorMap: () => ({ message: "Zgoda na przetwarzanie danych jest wymagana" }),
    }),
    zakres: z.array(z.enum(ZAKRES)).min(1, "Zaznacz co najmniej jeden zakres ubezpieczenia"),
  })
  .superRefine((dane, ctx) => {
    dane.lokalizacje.forEach((lok, i) => {
      if (!lok.adres.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lokalizacje", i, "adres"],
          message: "Adres lokalizacji jest wymagany",
        });
      }
    });

    if (sumaWniosku(dane) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lokalizacje"],
        message: "Podaj sumy ubezpieczenia przynajmniej dla jednej lokalizacji",
      });
    }

    if (!dane.brak_szkod && dane.szkody.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["szkody"],
        message: "Zaznaczono szkody w ostatnich 5 latach — wypełnij tabelę szkód",
      });
    }
  });

/** Pusta lokalizacja o podanym numerze - uzywana przy dodawaniu kolejnej w formularzu. */
export function pustaLokalizacja(nr: number): Lokalizacja {
  return lokalizacjaSchema.parse({ nr });
}

/** Pusty wniosek - stan startowy formularza. */
export function pustyWniosek(): Wniosek {
  return {
    ...wniosekSchema.parse({
      nazwa_firmy: "—",
      adres_siedziby: "—",
      email_kontaktowy: "brak@example.com",
      telefon: "—",
      rodzaj_dzialalnosci: "—",
      lokalizacje: [pustaLokalizacja(1)],
    }),
    nazwa_firmy: "",
    adres_siedziby: "",
    email_kontaktowy: "",
    telefon: "",
    rodzaj_dzialalnosci: "",
  };
}

export const KLUCZE_SUM = [
  "suma_budynek",
  "suma_wyposazenie",
  "suma_maszyny",
  "suma_srodki_obrotowe",
  "suma_elektronika_it",
  "suma_sprzet_medyczny",
  "suma_gotowka_lokal",
  "suma_gotowka_transport",
  "suma_szyby",
  "suma_mienie_pracownikow",
] as const;

/** Suma ubezpieczenia jednej lokalizacji - odpowiednik SUMA LOKALIZACJI z arkusza. */
export function sumaLokalizacji(lok: Lokalizacja): number {
  return KLUCZE_SUM.reduce((acc, klucz) => acc + (Number(lok[klucz]) || 0), 0);
}

/** Laczna suma ubezpieczenia wniosku - odpowiednik sekcji 6 z arkusza. */
export function sumaWniosku(dane: Pick<Wniosek, "lokalizacje">): number {
  return dane.lokalizacje.reduce((acc, lok) => acc + sumaLokalizacji(lok), 0);
}

/**
 * Kontrola spojnosci z arkusza: suma wykazu sprzetu vs deklarowana suma ubezpieczenia.
 * Zwraca rozbieznosci, ktore w Excelu byly podswietlane na czerwono.
 */
export function kontrolaSpojnosci(dane: Wniosek) {
  return dane.lokalizacje.map((lok) => {
    const wykazMedyczny = dane.sprzet_medyczny
      .filter((u) => u.lokalizacja === lok.nr)
      .reduce((acc, u) => acc + (Number(u.wartosc) || 0), 0);
    const wykazEei = dane.elektronika_eei
      .filter((u) => u.lokalizacja === lok.nr)
      .reduce((acc, u) => acc + (Number(u.wartosc) || 0), 0);

    return {
      nr: lok.nr,
      wykazMedyczny,
      deklarowanyMedyczny: Number(lok.suma_sprzet_medyczny) || 0,
      zgodnyMedyczny: wykazMedyczny === (Number(lok.suma_sprzet_medyczny) || 0),
      wykazEei,
      deklarowanyEei: Number(lok.suma_elektronika_it) || 0,
      zgodnyEei: wykazEei === (Number(lok.suma_elektronika_it) || 0),
    };
  });
}
