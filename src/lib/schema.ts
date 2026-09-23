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

/**
 * Schemat budujemy w dwoch trybach z jednej definicji pol:
 *
 * - "pelny"   - walidacja przy zlozeniu i podpowiedzi w formularzu: wymagane pola,
 *               format e-mail, suma kontrolna NIP, nieujemne kwoty, wartosci ze slownika.
 * - "roboczy" - autozapis w trakcie wypelniania. NIGDY nie odrzuca danych: tylko
 *               ujednolica typy (tekst z pola liczbowego -> liczba) i zachowuje
 *               dokladnie to, co klient wpisal, lacznie z bledami. Inaczej wniosek
 *               z samym wpisanym NIP-em z literowka w ogole by sie nie zapisal,
 *               a klient zobaczylby "Nie zapisano" przy pierwszym polu.
 *
 * Jedna lista pol dla obu trybow gwarantuje, ze nie rozjada sie po zmianie.
 */
type Tryb = "pelny" | "roboczy";

function zbuduj(tryb: Tryb) {
  const pelny = tryb === "pelny";

  // Twardy limit dlugosci pojedynczego pola tekstowego. Chroni baze i pamiec
  // przed wpisem-gigantem z zaczytanego pliku; 2000 znakow starcza na adres,
  // nazwe firmy czy opis dzialalnosci z ogromnym zapasem.
  const LIMIT_TEKST = 2000;
  const przytnij = (s: string) => s.slice(0, LIMIT_TEKST);

  const tekst = z
    .string()
    .trim()
    .catch("")
    .default("")
    .transform(przytnij);

  const wymagany = (komunikat: string) =>
    pelny
      ? z.string().trim().min(1, komunikat).max(LIMIT_TEKST, "Wpis jest zbyt długi").transform(przytnij)
      : tekst;

  /** Pole slownikowe: pusta wartosc albo wartosc z listy. W wersji roboczej dowolny tekst. */
  const zeSlownika = <T extends readonly [string, ...string[]]>(lista: T) =>
    pelny ? z.union([z.enum(lista), z.literal("")]).default("") : tekst;

  /** Kwota w pelnych zlotych. Puste pole i 0 sa rownowazne. */
  const kwota = pelny
    ? z.coerce
        .number({ invalid_type_error: "Podaj kwotę liczbą" })
        .min(0, "Kwota nie może być ujemna")
        .max(1_000_000_000, "Kwota wygląda na zawyżoną")
        .default(0)
    : z.coerce.number().catch(0).default(0);

  const liczbaLubPusto = (min: number, max: number) =>
    pelny
      ? z.coerce.number().min(min).max(max).nullable().default(null)
      : z.coerce.number().nullable().catch(null).default(null);

  const numerLokalizacji = pelny
    ? z.coerce.number().int().min(1).max(3).default(1)
    : z.coerce.number().int().catch(1).default(1);

  const flaga = pelny ? z.boolean().default(false) : z.boolean().catch(false).default(false);

  /** NIP: 10 cyfr, z suma kontrolna. Puste pole przechodzi - NIP nie jest wymagany. */
  const nip = pelny
    ? z
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
        )
    : tekst;

  const email = pelny
    ? z.string().trim().max(320, "Adres e-mail jest zbyt długi").email("Podaj poprawny adres e-mail")
    : tekst;

  const urzadzenieMedyczne = z.object({
    lokalizacja: numerLokalizacji,
    nazwa: tekst,
    producent: tekst,
    model: tekst,
    nr_seryjny: tekst,
    rok_zakupu: tekst,
    wartosc: kwota,
    cert_ce: flaga,
    uwagi: tekst,
  });

  const urzadzenieEei = z.object({
    lokalizacja: numerLokalizacji,
    nazwa: tekst,
    producent: tekst,
    model: tekst,
    rok_zakupu: tekst,
    wartosc: kwota,
    nr_seryjny: tekst,
    uwagi: tekst,
  });

  const szkoda = z.object({
    data: tekst,
    przyczyna: tekst,
    kwota_szkody: kwota,
    odszkodowanie: kwota,
    ubezpieczyciel: tekst,
  });

  const lokalizacja = z.object({
    nr: numerLokalizacji,
    nazwa: tekst,
    adres: tekst,
    typ_lokalu: zeSlownika(TYP_LOKALU),
    pietro: tekst,
    powierzchnia: liczbaLubPusto(0, 100000),
    rok_budowy: tekst,
    rok_remontu: tekst,
    material_scian: zeSlownika(MATERIAL_SCIAN),
    pokrycie_dachu: zeSlownika(POKRYCIE_DACHU),
    stan_techniczny: zeSlownika(STAN_TECHNICZNY),
    ogrzewanie: zeSlownika(OGRZEWANIE),
    budynek_wlasny: flaga,
    materialy_palne: flaga,

    // Sekcja 4A - zabezpieczenia przeciwpozarowe
    gasnice_szt: tekst,
    data_przegladu_gasnic: tekst,
    odleglosc_psp: tekst,
    hydranty: flaga,
    sap: flaga,
    tryskacze: flaga,
    drogi_ewakuacyjne: flaga,
    zakaz_palenia: flaga,

    // Sekcja 4B - zabezpieczenia antykradziezowe
    alarm_typ: zeSlownika(ALARM_TYP),
    agencja_ochrony: tekst,
    sejf_klasa: zeSlownika(SEJF_KLASA),
    ogrodzenie: flaga,
    agencja_24h: flaga,
    cctv: flaga,
    kraty: flaga,
    rolety: flaga,
    zamki_atestowane: flaga,
    drzwi_atestowane: flaga,
    szyby_antywlamaniowe: flaga,
    system_alarmowy: flaga,

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

  const lista = <T extends z.ZodTypeAny>(element: T) =>
    pelny ? z.array(element).default([]) : z.array(element).catch([]).default([]);

  const zakres = pelny
    ? z.array(z.enum(ZAKRES)).default([])
    : z
        .array(z.string())
        .catch([])
        .default([])
        .transform((a) => a.filter((x) => (ZAKRES as readonly string[]).includes(x)));

  const lokalizacje = pelny
    ? z.array(lokalizacja).min(1, "Wypełnij co najmniej jedną lokalizację").max(3)
    : z.array(lokalizacja).transform((a) => a.slice(0, 3));

  const wniosek = z.object({
    // Sekcja 1 - dane ubezpieczajacego
    nazwa_firmy: wymagany("Podaj nazwę firmy lub imię i nazwisko"),
    nip,
    regon: tekst,
    krs: tekst,
    adres_siedziby: wymagany("Podaj adres siedziby"),
    forma_prawna: zeSlownika(FORMA_PRAWNA),
    numer_pkd: tekst,
    email_kontaktowy: email,
    telefon: wymagany("Podaj numer telefonu"),
    osoba_kontaktu: tekst,
    stanowisko: tekst,

    // Sekcja 3 - profil dzialalnosci
    rodzaj_dzialalnosci: wymagany("Opisz rodzaj działalności"),
    liczba_pracownikow: zeSlownika(LICZBA_PRACOWNIKOW),
    roczny_obrot: zeSlownika(ROCZNY_OBROT),
    zabiegi: lista(z.string()),

    // Sekcje 2 i 4 - lokalizacje (max 3 jak w szablonie Excel)
    lokalizacje,

    // Sekcja 5 - zakres
    zakres,

    // Wykazy sprzetu (przypisane do lokalizacji przez pole `lokalizacja`)
    sprzet_medyczny: lista(urzadzenieMedyczne),
    elektronika_eei: lista(urzadzenieEei),

    // Sekcja 7 - szkodowosc
    brak_szkod: pelny ? z.boolean().default(true) : z.boolean().catch(true).default(true),
    szkody: lista(szkoda),

    // Sekcja 8 - dotychczasowa polisa
    posiada_polise: flaga,
    towarzystwo_obecne: tekst,
    nr_polisy_obecny: tekst,
    waznosc_do: tekst,
    roczna_skladka_obecna: pelny
      ? z.coerce.number().min(0, "Kwota nie może być ujemna").nullable().default(null)
      : z.coerce.number().nullable().catch(null).default(null),

    // Sekcja 9 - uwagi i oswiadczenia
    uwagi: tekst,
    miejscowosc_podpisu: tekst,
    data_podpisu: tekst,
    zgoda_prawdziwosc: flaga,
    zgoda_rodo: flaga,
  });

  return { wniosek, lokalizacja, urzadzenieMedyczne, urzadzenieEei, szkoda };
}

const pelny = zbuduj("pelny");
const roboczy = zbuduj("roboczy");

export const urzadzenieMedyczneSchema = pelny.urzadzenieMedyczne;
export const urzadzenieEeiSchema = pelny.urzadzenieEei;
export const szkodaSchema = pelny.szkoda;
export const lokalizacjaSchema = pelny.lokalizacja;
export const wniosekSchema = pelny.wniosek;

/** Autozapis wersji roboczej - nigdy nie odrzuca danych, tylko ujednolica typy. */
export const wniosekRoboczySchema = roboczy.wniosek;

export type Wniosek = z.infer<typeof wniosekSchema>;
/** Szerszy typ: to, co faktycznie lezy w bazie i w formularzu w trakcie wypelniania. */
export type WniosekRoboczy = z.infer<typeof wniosekRoboczySchema>;
export type Lokalizacja = z.infer<typeof lokalizacjaSchema>;
export type LokalizacjaRobocza = WniosekRoboczy["lokalizacje"][number];
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
export function pustyWniosek(): WniosekRoboczy {
  return wniosekRoboczySchema.parse({ lokalizacje: [pustaLokalizacja(1)] });
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
export function sumaLokalizacji(lok: LokalizacjaRobocza): number {
  return KLUCZE_SUM.reduce((acc, klucz) => acc + (Number(lok[klucz]) || 0), 0);
}

/** Laczna suma ubezpieczenia wniosku - odpowiednik sekcji 6 z arkusza. */
export function sumaWniosku(dane: Pick<WniosekRoboczy, "lokalizacje">): number {
  return dane.lokalizacje.reduce((acc, lok) => acc + sumaLokalizacji(lok), 0);
}

/**
 * Kontrola spojnosci z arkusza: suma wykazu sprzetu vs deklarowana suma ubezpieczenia.
 * Zwraca rozbieznosci, ktore w Excelu byly podswietlane na czerwono.
 */
export function kontrolaSpojnosci(dane: WniosekRoboczy) {
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

/**
 * Numeracja lokalizacji zawsze 1..n, a sprzet wskazuje na istniejace lokalizacje.
 *
 * Po usunieciu srodkowej lokalizacji numery mialyby dziure (1 i 3), a sprzet
 * wskazywalby na lokalizacje, ktorej juz nie ma - eksport do Excela i kontrola
 * spojnosci rozjechalyby sie. Formularz przenumerowuje juz przy usuwaniu;
 * zapis robi to drugi raz jako zabezpieczenie niezalezne od interfejsu.
 * Sprzet z usunietej lokalizacji trafia do lokalizacji 1 - nie jest kasowany,
 * bo klient go wpisal i ma go zobaczyc.
 */
export function znormalizujNumeracje<T extends WniosekRoboczy>(dane: T): T {
  const mapa = new Map<number, number>();
  const lokalizacje = dane.lokalizacje.map((lok, i) => {
    if (!mapa.has(lok.nr)) mapa.set(lok.nr, i + 1);
    return { ...lok, nr: i + 1 };
  });
  const przepnij = <U extends { lokalizacja: number }>(u: U): U => ({
    ...u,
    lokalizacja: mapa.get(Number(u.lokalizacja)) ?? 1,
  });
  return {
    ...dane,
    lokalizacje,
    sprzet_medyczny: dane.sprzet_medyczny.map(przepnij),
    elektronika_eei: dane.elektronika_eei.map(przepnij),
  };
}
