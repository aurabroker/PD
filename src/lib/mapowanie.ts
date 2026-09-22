/**
 * Tlumaczenie miedzy obiektem `Wniosek` (schemat zod) a wierszami w Postgresie.
 *
 * Uwaga do modelu danych w BEAUTY: tabela `mienie_wnioski` ma komplet kolumn
 * lokalizacji (adres, zabezpieczenia, sumy) odziedziczony po wersji jednolokalizacyjnej,
 * a rownolegle istnieje tabela `mienie_lokalizacje`. Zrodlem prawdy jest tutaj
 * `mienie_lokalizacje` (wszystkie lokalizacje), natomiast lokalizacja nr 1 jest
 * dodatkowo kopiowana do kolumn wniosku, zeby starsze raporty czytajace tylko
 * `mienie_wnioski` nadal widzialy komplet danych.
 */
import { pustaLokalizacja, sumaLokalizacji, wniosekSchema } from "./schema";
import type { Lokalizacja, Wniosek } from "./schema";
import { ZAKRES } from "./slowniki";
import type { KluczSumy } from "./slowniki";

type Wiersz = Record<string, unknown>;

const txt = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => v === true;

/** Sumy ubezpieczenia jednej lokalizacji. */
function kolumnySum(lok: Lokalizacja): Wiersz {
  return {
    suma_budynek: lok.suma_budynek,
    suma_wyposazenie: lok.suma_wyposazenie,
    suma_maszyny: lok.suma_maszyny,
    suma_srodki_obrotowe: lok.suma_srodki_obrotowe,
    suma_elektronika_it: lok.suma_elektronika_it,
    suma_sprzet_medyczny: lok.suma_sprzet_medyczny,
    suma_gotowka_lokal: lok.suma_gotowka_lokal,
    suma_gotowka_transport: lok.suma_gotowka_transport,
    suma_szyby: lok.suma_szyby,
    suma_mienie_pracownikow: lok.suma_mienie_pracownikow,
  };
}

/**
 * Sumy zbiorcze ze wszystkich lokalizacji - odpowiednik kolumny RAZEM z sekcji 6 arkusza.
 *
 * To wlasnie te kolumny zasilaja `mienie_wnioski.suma_lacznie` (GENERATED). Gdyby wniosek
 * przechowywal tu tylko lokalizacje 1, laczna suma bylaby zanizona przy kilku lokalizacjach,
 * a to ona pokazuje sie na liscie w panelu i w zestawieniach.
 */
function kolumnySumZbiorczych(lokalizacje: Lokalizacja[]): Wiersz {
  const suma = (klucz: KluczSumy) =>
    lokalizacje.reduce((acc, lok) => acc + (Number(lok[klucz]) || 0), 0);

  return {
    suma_budynek: suma("suma_budynek"),
    suma_wyposazenie: suma("suma_wyposazenie"),
    suma_maszyny: suma("suma_maszyny"),
    suma_srodki_obrotowe: suma("suma_srodki_obrotowe"),
    suma_elektronika_it: suma("suma_elektronika_it"),
    suma_sprzet_medyczny: suma("suma_sprzet_medyczny"),
    suma_gotowka_lokal: suma("suma_gotowka_lokal"),
    suma_gotowka_transport: suma("suma_gotowka_transport"),
    suma_szyby: suma("suma_szyby"),
    suma_mienie_pracownikow: suma("suma_mienie_pracownikow"),
  };
}

/** Charakterystyka i zabezpieczenia lokalizacji - bez sum. */
function kolumnyLokalizacji(lok: Lokalizacja): Wiersz {
  return {
    typ_lokalu: lok.typ_lokalu,
    pietro: lok.pietro,
    powierzchnia: lok.powierzchnia,
    rok_budowy: lok.rok_budowy,
    rok_remontu: lok.rok_remontu,
    material_scian: lok.material_scian,
    pokrycie_dachu: lok.pokrycie_dachu,
    stan_techniczny: lok.stan_techniczny,
    ogrzewanie: lok.ogrzewanie,
    budynek_wlasny: lok.budynek_wlasny,
    materialy_palne: lok.materialy_palne,
    gasnice_szt: lok.gasnice_szt,
    data_przegladu_gasnic: lok.data_przegladu_gasnic,
    odleglosc_psp: lok.odleglosc_psp,
    hydranty: lok.hydranty,
    sap: lok.sap,
    tryskacze: lok.tryskacze,
    drogi_ewakuacyjne: lok.drogi_ewakuacyjne,
    zakaz_palenia: lok.zakaz_palenia,
    alarm_typ: lok.alarm_typ,
    agencja_ochrony: lok.agencja_ochrony,
    agencja_24h: lok.agencja_24h,
    sejf_klasa: lok.sejf_klasa,
    ogrodzenie: lok.ogrodzenie,
    cctv: lok.cctv,
    kraty: lok.kraty,
    rolety: lok.rolety,
    zamki_atestowane: lok.zamki_atestowane,
    drzwi_atestowane: lok.drzwi_atestowane,
    szyby_antywlamaniowe: lok.szyby_antywlamaniowe,
    system_alarmowy: lok.system_alarmowy,
  };
}

/** Wiersz tabeli `mienie_wnioski` na podstawie danych z formularza. */
export function doWierszaWniosku(dane: Wniosek): Wiersz {
  const pierwsza = dane.lokalizacje[0] ?? pustaLokalizacja(1);

  return {
    nazwa_firmy: dane.nazwa_firmy,
    nip: dane.nip,
    regon: dane.regon,
    krs: dane.krs,
    adres_siedziby: dane.adres_siedziby,
    forma_prawna: dane.forma_prawna,
    numer_pkd: dane.numer_pkd,
    email_kontaktowy: dane.email_kontaktowy,
    telefon: dane.telefon,
    osoba_kontaktu: dane.osoba_kontaktu,
    stanowisko: dane.stanowisko,

    rodzaj_dzialalnosci: dane.rodzaj_dzialalnosci,
    liczba_pracownikow: dane.liczba_pracownikow,
    roczny_obrot: dane.roczny_obrot,
    zabiegi: dane.zabiegi,

    // Charakterystyka i zabezpieczenia: kopia lokalizacji 1 (patrz komentarz na gorze pliku).
    adres_lokalizacji: pierwsza.adres,
    ...kolumnyLokalizacji(pierwsza),
    // Sumy: zbiorczo ze wszystkich lokalizacji, zeby `suma_lacznie` byla laczna suma wniosku.
    ...kolumnySumZbiorczych(dane.lokalizacje),

    zakres: dane.zakres,
    // Uwaga: `mienie_wnioski.suma_lacznie` to kolumna GENERATED ALWAYS - Postgres
    // odrzuca zapis do niej. Liczy sie sama z pozycji sum. W `mienie_lokalizacje`
    // ta sama nazwa jest juz zwykla kolumna i tam wartosc trzeba podac.

    brak_szkod: dane.brak_szkod,
    szkody: dane.brak_szkod ? [] : dane.szkody,

    posiada_polise: dane.posiada_polise,
    towarzystwo_obecne: dane.posiada_polise ? dane.towarzystwo_obecne : "",
    nr_polisy_obecny: dane.posiada_polise ? dane.nr_polisy_obecny : "",
    waznosc_do: dane.posiada_polise ? dane.waznosc_do : "",
    roczna_skladka_obecna: dane.posiada_polise ? dane.roczna_skladka_obecna : null,

    uwagi: dane.uwagi,
    miejscowosc_podpisu: dane.miejscowosc_podpisu,
    data_podpisu: dane.data_podpisu || null,
    zgoda_prawdziwosc: dane.zgoda_prawdziwosc,
    zgoda_rodo: dane.zgoda_rodo,

    // Wykazy sprzetu trzymane tez zbiorczo na wniosku - wygodne do listy w panelu
    sprzet_medyczny: dane.sprzet_medyczny,
    elektronika_eei: dane.elektronika_eei,

    updated_at: new Date().toISOString(),
  };
}

/** Wiersze tabeli `mienie_lokalizacje` dla danego wniosku. */
export function doWierszyLokalizacji(
  dane: Wniosek,
  wniosekId: string,
  companyId: number | null,
  formToken: string,
): Wiersz[] {
  return dane.lokalizacje.map((lok) => ({
    wniosek_id: wniosekId,
    company_id: companyId,
    form_token: formToken,
    nr: lok.nr,
    nazwa: lok.nazwa || `Lokalizacja ${lok.nr}`,
    adres: lok.adres,
    ...kolumnyLokalizacji(lok),
    ...kolumnySum(lok),
    suma_lacznie: sumaLokalizacji(lok),
    sprzet_medyczny: dane.sprzet_medyczny.filter((u) => u.lokalizacja === lok.nr),
    elektronika_eei: dane.elektronika_eei.filter((u) => u.lokalizacja === lok.nr),
  }));
}

/** Odtworzenie lokalizacji z wiersza `mienie_lokalizacje`. */
function zWierszaLokalizacji(w: Wiersz): Lokalizacja {
  return {
    nr: num(w.nr) || 1,
    nazwa: txt(w.nazwa),
    adres: txt(w.adres),
    typ_lokalu: txt(w.typ_lokalu),
    pietro: txt(w.pietro),
    powierzchnia: numOrNull(w.powierzchnia),
    rok_budowy: txt(w.rok_budowy),
    rok_remontu: txt(w.rok_remontu),
    material_scian: txt(w.material_scian),
    pokrycie_dachu: txt(w.pokrycie_dachu),
    stan_techniczny: txt(w.stan_techniczny),
    ogrzewanie: txt(w.ogrzewanie),
    budynek_wlasny: bool(w.budynek_wlasny),
    materialy_palne: bool(w.materialy_palne),
    gasnice_szt: txt(w.gasnice_szt),
    data_przegladu_gasnic: txt(w.data_przegladu_gasnic),
    odleglosc_psp: txt(w.odleglosc_psp),
    hydranty: bool(w.hydranty),
    sap: bool(w.sap),
    tryskacze: bool(w.tryskacze),
    drogi_ewakuacyjne: bool(w.drogi_ewakuacyjne),
    zakaz_palenia: bool(w.zakaz_palenia),
    alarm_typ: txt(w.alarm_typ),
    agencja_ochrony: txt(w.agencja_ochrony),
    sejf_klasa: txt(w.sejf_klasa),
    ogrodzenie: bool(w.ogrodzenie),
    agencja_24h: bool(w.agencja_24h),
    cctv: bool(w.cctv),
    kraty: bool(w.kraty),
    rolety: bool(w.rolety),
    zamki_atestowane: bool(w.zamki_atestowane),
    drzwi_atestowane: bool(w.drzwi_atestowane),
    szyby_antywlamaniowe: bool(w.szyby_antywlamaniowe),
    system_alarmowy: bool(w.system_alarmowy),
    suma_budynek: num(w.suma_budynek),
    suma_wyposazenie: num(w.suma_wyposazenie),
    suma_maszyny: num(w.suma_maszyny),
    suma_srodki_obrotowe: num(w.suma_srodki_obrotowe),
    suma_elektronika_it: num(w.suma_elektronika_it),
    suma_sprzet_medyczny: num(w.suma_sprzet_medyczny),
    suma_gotowka_lokal: num(w.suma_gotowka_lokal),
    suma_gotowka_transport: num(w.suma_gotowka_transport),
    suma_szyby: num(w.suma_szyby),
    suma_mienie_pracownikow: num(w.suma_mienie_pracownikow),
  } as Lokalizacja;
}

/**
 * Odtworzenie obiektu `Wniosek` z bazy.
 *
 * Gdy wniosek nie ma jeszcze wierszy w `mienie_lokalizacje` (tak wygladaja wnioski
 * zlozone przed ta aplikacja), lokalizacja 1 jest odtwarzana z kolumn wniosku.
 */
export function zWierszy(wniosek: Wiersz, lokalizacje: Wiersz[]): Wniosek {
  const zTabeli = lokalizacje
    .map(zWierszaLokalizacji)
    .sort((a, b) => a.nr - b.nr);

  const zKolumnWniosku: Lokalizacja = {
    ...zWierszaLokalizacji({ ...wniosek, nr: 1, adres: wniosek.adres_lokalizacji }),
    nazwa: "Lokalizacja 1",
  };

  const listaLokalizacji = zTabeli.length > 0 ? zTabeli : [zKolumnWniosku];

  const surowy = {
    nazwa_firmy: txt(wniosek.nazwa_firmy),
    nip: txt(wniosek.nip),
    regon: txt(wniosek.regon),
    krs: txt(wniosek.krs),
    adres_siedziby: txt(wniosek.adres_siedziby),
    forma_prawna: txt(wniosek.forma_prawna),
    numer_pkd: txt(wniosek.numer_pkd),
    email_kontaktowy: txt(wniosek.email_kontaktowy),
    telefon: txt(wniosek.telefon),
    osoba_kontaktu: txt(wniosek.osoba_kontaktu),
    stanowisko: txt(wniosek.stanowisko),
    rodzaj_dzialalnosci: txt(wniosek.rodzaj_dzialalnosci),
    liczba_pracownikow: txt(wniosek.liczba_pracownikow),
    roczny_obrot: txt(wniosek.roczny_obrot),
    zabiegi: Array.isArray(wniosek.zabiegi) ? wniosek.zabiegi : [],
    lokalizacje: listaLokalizacji,
    // Odfiltrowanie etykiet spoza slownika - stare wnioski moga miec inne brzmienie
    zakres: (Array.isArray(wniosek.zakres) ? wniosek.zakres : []).filter((z): z is string =>
      (ZAKRES as readonly string[]).includes(String(z)),
    ),
    sprzet_medyczny: Array.isArray(wniosek.sprzet_medyczny) ? wniosek.sprzet_medyczny : [],
    elektronika_eei: Array.isArray(wniosek.elektronika_eei) ? wniosek.elektronika_eei : [],
    brak_szkod: wniosek.brak_szkod !== false,
    szkody: Array.isArray(wniosek.szkody) ? wniosek.szkody : [],
    posiada_polise: bool(wniosek.posiada_polise),
    towarzystwo_obecne: txt(wniosek.towarzystwo_obecne),
    nr_polisy_obecny: txt(wniosek.nr_polisy_obecny),
    waznosc_do: txt(wniosek.waznosc_do),
    roczna_skladka_obecna: numOrNull(wniosek.roczna_skladka_obecna),
    uwagi: txt(wniosek.uwagi),
    miejscowosc_podpisu: txt(wniosek.miejscowosc_podpisu),
    data_podpisu: txt(wniosek.data_podpisu),
    zgoda_prawdziwosc: bool(wniosek.zgoda_prawdziwosc),
    zgoda_rodo: bool(wniosek.zgoda_rodo),
  };

  // Wnioski sprzed tej aplikacji moga miec puste pola wymagane - `catch` chroni
  // panel przed wywroceniem sie na niekompletnym, ale wartosciowym rekordzie.
  const wynik = wniosekSchema.safeParse(surowy);
  return wynik.success ? wynik.data : ({ ...surowy } as unknown as Wniosek);
}
