/**
 * Test end-to-end formularza wniosku na lokalnej replice produkcji.
 *
 * Uruchomienie: patrz tests/e2e/README.md. Konfiguracja przez zmienne:
 *   E2E_APP     adres aplikacji (domyslnie http://127.0.0.1:8800)
 *   E2E_PSQL    polecenie psql do repliki (domyslnie psql -h 127.0.0.1 -p 54322 -U postgres -d beauty)
 *   E2E_CHROME  sciezka do Chromium, jesli nie ma go w domyslnym miejscu Playwrighta
 *   TYLKO       np. TYLKO=T1,T5 - tylko wybrane scenariusze
 * Przegladarka (Chromium) -> Worker (workerd, build OpenNext) -> PostgREST -> Postgres 16
 * ze schematem 1:1 z BEAUTY. Kazdy scenariusz lapie bledy JS, konsoli i odpowiedzi 5xx.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generujKorpus } from "./generuj-zlosliwe.mjs";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const TMP = tmpdir();

const APP = process.env.E2E_APP ?? "http://127.0.0.1:8800";
const CHROME = process.env.E2E_CHROME;
const PSQL = process.env.E2E_PSQL ?? "psql -h 127.0.0.1 -p 54322 -U postgres -d beauty";
const XLSX_WYPELNIONY = path.join(KATALOG, "pliki", "wniosek-wypelniony.xlsx");
const XLSX_Z_OSTRZEZENIAMI = path.join(KATALOG, "pliki", "wniosek-z-ostrzezeniami.xlsx");
const TYLKO = process.env.TYLKO?.split(",") ?? null;

const sql = (q) =>
  execSync(`${PSQL} -tA -F'|' -c ${JSON.stringify(q.replace(/\s+/g, " "))}`, { encoding: "utf-8" }).trim();

const wyniki = [];
let biezacy = "";
function sprawdz(warunek, opis, szczegol = "") {
  wyniki.push({ scenariusz: biezacy, ok: Boolean(warunek), opis, szczegol });
  console.log(`  ${warunek ? "PASS" : "FAIL"}  ${opis}${!warunek && szczegol ? `\n        -> ${szczegol}` : ""}`);
}

async function nowaStrona(browser, opcje = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, locale: "pl-PL", ...opcje });
  const page = await ctx.newPage();
  const bledy = [];
  page.on("pageerror", (e) => bledy.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") bledy.push(`console.error: ${m.text()}`); });
  page.on("response", (r) => {
    if (r.status() >= 500) bledy.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
    else if (r.status() >= 400) bledy.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return { ctx, page, bledy };
}

const pole = (page, nazwa) => page.locator(`[name="${nazwa}"]`);
async function wpisz(page, nazwa, wartosc) { await pole(page, nazwa).fill(String(wartosc)); }
async function wybierz(page, nazwa, wartosc) { await pole(page, nazwa).selectOption(String(wartosc)); }
async function zaznacz(page, nazwa, stan = true) {
  const p = pole(page, nazwa);
  if ((await p.isChecked()) !== stan) await p.click();
}
async function krok(page, etykieta) {
  await page.getByRole("navigation", { name: "Kroki wniosku" }).getByRole("button", { name: new RegExp(etykieta) }).click();
}
async function dalej(page) { await page.getByRole("button", { name: "Dalej →" }).click(); }

/**
 * Wpis daty tak, jak przyjdzie z Safari z polem tekstowym zamiast kalendarza.
 * Jeden atomowy ruch: React 19 przy kazdym renderze przywraca type="date",
 * a Chromium odrzuca wtedy wartosc spoza RRRR-MM-DD.
 */
async function wpiszDateJakSafari(page, wartosc) {
  await page.evaluate((w) => {
    const el = document.querySelector('[name="data_podpisu"]');
    el.type = "text";
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, w);
    // Tylko "input" - jak przy pisaniu. Drugi event odczytalby juz pole
    // wyczyszczone przez Chromium po tym, jak React przywroci type="date".
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, wartosc);
}

/** Czeka, az autozapis sie ustabilizuje, i zwraca koncowy stan wskaznika. */
async function stanZapisu(page, limitMs = 12000) {
  const start = Date.now();
  let ostatni = "";
  while (Date.now() - start < limitMs) {
    const zapisano = await page.getByText("Zapisano ✓").isVisible().catch(() => false);
    const blad = await page.getByText(/Nie zapisano/).isVisible().catch(() => false);
    const trwa = await page.getByText("Zapisuję…").isVisible().catch(() => false);
    ostatni = zapisano ? "zapisano" : blad ? "blad" : trwa ? "trwa" : "brak";
    if ((zapisano || blad) && !trwa) {
      await page.waitForTimeout(3500); // okno autozapisu 3 s - czy nie wystartuje kolejny
      const trwaZnowu = await page.getByText("Zapisuję…").isVisible().catch(() => false);
      if (!trwaZnowu) return (await page.getByText(/Nie zapisano/).isVisible().catch(() => false)) ? "blad" : "zapisano";
    }
    await page.waitForTimeout(300);
  }
  return ostatni;
}

async function nowyWniosek(page) {
  await page.goto(APP + "/");
  await page.getByRole("button", { name: "Rozpocznij wniosek" }).click();
  await page.waitForURL(/\/wniosek\/[^/]+$/, { timeout: 20000 });
  return decodeURIComponent(page.url().split("/wniosek/")[1]);
}

async function wypelnijDaneFirmy(page, dane = {}) {
  await wpisz(page, "nazwa_firmy", dane.nazwa ?? "Salon Testowy Ąę sp. z o.o.");
  await wpisz(page, "nip", dane.nip ?? "1111111111");
  await wpisz(page, "regon", "146123456");
  await wpisz(page, "krs", "0000123456");
  await wybierz(page, "forma_prawna", "Spółka z o.o.");
  await wpisz(page, "numer_pkd", "96.02.Z");
  await wpisz(page, "adres_siedziby", "ul. Złota 44, 00-120 Warszawa");
  await wpisz(page, "email_kontaktowy", dane.email ?? "test@salon-testowy.pl");
  await wpisz(page, "telefon", "+48 601 234 567");
  await wpisz(page, "osoba_kontaktu", "Żaneta Łukasiewicz");
  await wpisz(page, "stanowisko", "Właścicielka");
  await wpisz(page, "rodzaj_dzialalnosci", "Salon kosmetyczny z medycyną estetyczną");
  await wybierz(page, "liczba_pracownikow", "6–10");
  await wybierz(page, "roczny_obrot", "1–3 mln PLN");
}

async function wypelnijLokalizacje(page, i, sumy) {
  const p = (n) => `lokalizacje.${i}.${n}`;
  await wpisz(page, p("nazwa"), `Oddział ${i + 1}`);
  await wpisz(page, p("adres"), `ul. Testowa ${i + 1}, 00-00${i} Warszawa`);
  await wybierz(page, p("typ_lokalu"), "Lokal usługowy");
  await wpisz(page, p("pietro"), "0");
  await wpisz(page, p("powierzchnia"), 120 + i);
  await wpisz(page, p("rok_budowy"), "2005");
  await wpisz(page, p("rok_remontu"), "2021");
  await wybierz(page, p("material_scian"), "Żelbet / beton");
  await wybierz(page, p("pokrycie_dachu"), "Strop żelbetowy (flat)");
  await wybierz(page, p("stan_techniczny"), "Bardzo dobry");
  await wybierz(page, p("ogrzewanie"), "Centralne (sieciowe)");
  await zaznacz(page, p("budynek_wlasny"));
  await wpisz(page, p("gasnice_szt"), "3");
  await wpisz(page, p("data_przegladu_gasnic"), "15.03.2026");
  await wpisz(page, p("odleglosc_psp"), "2");
  for (const c of ["hydranty", "sap", "drogi_ewakuacyjne", "zakaz_palenia"]) await zaznacz(page, p(c));
  await wybierz(page, p("alarm_typ"), "Monitoring przez agencję ochrony");
  await wpisz(page, p("agencja_ochrony"), "Securitas");
  await wybierz(page, p("sejf_klasa"), "II");
  for (const c of ["agencja_24h", "cctv", "rolety", "zamki_atestowane", "drzwi_atestowane", "system_alarmowy"]) await zaznacz(page, p(c));
  for (const [k, v] of Object.entries(sumy)) await wpisz(page, p(k), v);
}

async function uruchom(nazwa, fn, browser) {
  if (TYLKO && !TYLKO.includes(nazwa.split(" ")[0])) return;
  biezacy = nazwa;
  console.log(`\n=== ${nazwa} ===`);
  const s = await nowaStrona(browser);
  try {
    await fn(s);
  } catch (e) {
    sprawdz(false, "scenariusz przeszedl bez wyjatku", e.message.split("\n")[0]);
    await s.page.screenshot({ path: path.join(TMP, `e2e-blad-${nazwa.split(" ")[0]}.png`), fullPage: true }).catch(() => {});
  }
  sprawdz(s.bledy.length === 0, "brak bledow JS / konsoli / 5xx", s.bledy.slice(0, 5).join(" | "));
  await s.ctx.close();
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ---------------------------------------------------------------------------
await uruchom("T1 pelna sciezka: 2 lokalizacje, sprzet, szkody, polisa, zlozenie", async ({ page }) => {
  const token = await nowyWniosek(page);
  sprawdz(token.length > 30, "utworzono wniosek i przekierowano do formularza", token);

  await wypelnijDaneFirmy(page);
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  sprawdz(await page.getByRole("button", { name: /Lokalizacja 2/ }).isVisible(), "dodano drugą lokalizację (krok w nawigacji)");
  sprawdz((await stanZapisu(page)) === "zapisano", "autozapis po danych firmy");

  await dalej(page);
  await wypelnijLokalizacje(page, 0, {
    suma_budynek: 450000, suma_wyposazenie: 120000, suma_maszyny: 60000, suma_srodki_obrotowe: 85000,
    suma_elektronika_it: 9000, suma_sprzet_medyczny: 310000, suma_gotowka_lokal: 5000,
    suma_gotowka_transport: 3000, suma_szyby: 18000, suma_mienie_pracownikow: 7000,
  });
  const sumaL1 = await page.getByText("Suma lokalizacji").locator("..").innerText();
  sprawdz(sumaL1.replace(/\s/g, "").includes("1067000"), "suma lokalizacji 1 liczy się na żywo (1 067 000 zł)", sumaL1);

  await dalej(page);
  await wypelnijLokalizacje(page, 1, { suma_wyposazenie: 80000, suma_elektronika_it: 3500, suma_sprzet_medyczny: 95000 });

  await dalej(page); // sprzet medyczny
  await page.getByRole("button", { name: "+ Dodaj urządzenie" }).click();
  await page.getByRole("button", { name: "+ Dodaj urządzenie" }).click();
  await page.getByRole("button", { name: "+ Dodaj urządzenie" }).click();
  for (const [i, [lok, nazwa, wart]] of [[1, "Laser CO2", 210000], [1, "Kriolipoliza", 100000], [2, "HIFU", 95000]].entries()) {
    await wybierz(page, `sprzet_medyczny.${i}.lokalizacja`, lok);
    await wpisz(page, `sprzet_medyczny.${i}.nazwa`, nazwa);
    await wpisz(page, `sprzet_medyczny.${i}.producent`, "Producent");
    await wpisz(page, `sprzet_medyczny.${i}.model`, "M-1");
    await wpisz(page, `sprzet_medyczny.${i}.nr_seryjny`, `SN-${i}`);
    await wpisz(page, `sprzet_medyczny.${i}.rok_zakupu`, "2023");
    await wpisz(page, `sprzet_medyczny.${i}.wartosc`, wart);
    await zaznacz(page, `sprzet_medyczny.${i}.cert_ce`);
  }

  await dalej(page); // elektronika
  await page.getByRole("button", { name: "+ Dodaj sprzęt" }).click();
  await page.getByRole("button", { name: "+ Dodaj sprzęt" }).click();
  for (const [i, [lok, nazwa, wart]] of [[1, "Kasa fiskalna", 9000], [2, "Terminal", 3500]].entries()) {
    await wybierz(page, `elektronika_eei.${i}.lokalizacja`, lok);
    await wpisz(page, `elektronika_eei.${i}.nazwa`, nazwa);
    await wpisz(page, `elektronika_eei.${i}.wartosc`, wart);
  }

  await dalej(page); // szkodowosc
  await zaznacz(page, "brak_szkod", false);
  await page.getByRole("button", { name: "+ Dodaj szkodę" }).click();
  await wpisz(page, "szkody.0.data", "12.01.2024");
  await wpisz(page, "szkody.0.przyczyna", "Zalanie z pionu");
  await wpisz(page, "szkody.0.ubezpieczyciel", "PZU");
  await wpisz(page, "szkody.0.kwota_szkody", 28000);
  await wpisz(page, "szkody.0.odszkodowanie", 22000);

  await dalej(page); // podsumowanie
  for (const z of ["Mienie od ognia i zdarzeń losowych", "Kradzież z włamaniem i rabunek", "Sprzęt medyczny / aparatura"]) {
    await page.locator(`input[type=checkbox][value="${z}"]`).check();
  }
  await zaznacz(page, "posiada_polise");
  await wpisz(page, "towarzystwo_obecne", "Warta");
  await wpisz(page, "nr_polisy_obecny", "POL-1");
  await wpisz(page, "waznosc_do", "31.12.2026");
  await wpisz(page, "roczna_skladka_obecna", 14500);
  await wpisz(page, "uwagi", "Uwagi z polskimi znakami: zażółć gęślą jaźń 🙂");
  await wpisz(page, "miejscowosc_podpisu", "Warszawa");
  await wpisz(page, "data_podpisu", "2026-09-23");
  await zaznacz(page, "zgoda_prawdziwosc");
  await zaznacz(page, "zgoda_rodo");
  const sumaCala = await page.getByText("Łączna suma ubezpieczenia", { exact: true }).locator("..").innerText();
  sprawdz(sumaCala.replace(/\s/g, "").includes("1245500"), "łączna suma w podsumowaniu (1 245 500 zł)", sumaCala);
  sprawdz((await stanZapisu(page)) === "zapisano", "autozapis po wypełnieniu całości");

  // Odswiezenie strony - dane musza przetrwac
  await page.reload();
  await page.waitForLoadState("networkidle");
  sprawdz((await pole(page, "nazwa_firmy").inputValue()) === "Salon Testowy Ąę sp. z o.o.", "po odświeżeniu: nazwa firmy zachowana");
  await krok(page, "Lokalizacja 2");
  sprawdz((await pole(page, "lokalizacje.1.adres").inputValue()).includes("Testowa 2"), "po odświeżeniu: adres lokalizacji 2 zachowany");
  await krok(page, "Sprzęt medyczny");
  sprawdz((await pole(page, "sprzet_medyczny.2.nazwa").inputValue()) === "HIFU", "po odświeżeniu: 3. urządzenie medyczne zachowane");
  await krok(page, "Podsumowanie");
  sprawdz(await page.locator('input[type=checkbox][value="Kradzież z włamaniem i rabunek"]').isChecked(), "po odświeżeniu: zakres zachowany");
  sprawdz(await pole(page, "zgoda_rodo").isChecked(), "po odświeżeniu: zgoda RODO zachowana");

  await page.getByRole("button", { name: "Złóż wniosek" }).click();
  await page.waitForURL(/\/zlozony$/, { timeout: 20000 });
  sprawdz(await page.getByText("Dziękujemy").isVisible(), "strona potwierdzenia po złożeniu");
  const potw = await page.locator("main").innerText();
  sprawdz(/MIE-\d{6}-[A-Z0-9]{6}/.test(potw), "numer referencyjny widoczny na potwierdzeniu", potw.slice(0, 200));

  // Weryfikacja w bazie
  const [status, wyslano, suma, zakres, med, eei, szk, rodo, data] = sql(
    `select status, wyslano_at is not null, suma_lacznie, jsonb_array_length(zakres), jsonb_array_length(sprzet_medyczny),
            jsonb_array_length(elektronika_eei), jsonb_array_length(szkody), zgoda_rodo, data_podpisu
     from mienie_wnioski where form_token='${token}'`).split("|");
  sprawdz(status === "zlozony", "DB: status = zlozony", status);
  sprawdz(wyslano === "t", "DB: wyslano_at ustawione");
  sprawdz(Number(suma) === 1245500, "DB: suma_lacznie (kolumna generowana) = 1 245 500", suma);
  sprawdz(zakres === "3" && med === "3" && eei === "2" && szk === "1", "DB: zakres 3, med 3, eei 2, szkody 1", `${zakres}/${med}/${eei}/${szk}`);
  sprawdz(rodo === "t" && data === "2026-09-23", "DB: zgoda RODO i data podpisu", `${rodo} ${data}`);
  const lok = sql(`select l.nr, l.suma_lacznie, jsonb_array_length(l.sprzet_medyczny) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}' order by nr`);
  sprawdz(lok === "1|1067000|2\n2|178500|1", "DB: dokładnie 2 lokalizacje, sumy i przypisany sprzęt", lok.replace(/\n/g, " ; "));
  const uw = sql(`select uwagi from mienie_wnioski where form_token='${token}'`);
  sprawdz(uw.includes("zażółć gęślą jaźń 🙂"), "DB: polskie znaki i emoji zapisane bez zniekształceń", uw);

  // Pobranie Excela i ponowny import
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Pobierz wniosek/ }).click()]);
  const sciezka = path.join(TMP, "e2e-pobrany.xlsx");
  await dl.saveAs(sciezka);
  sprawdz(readFileSync(sciezka).length > 20000, "pobrano plik .xlsx", `${readFileSync(sciezka).length} B`);
  writeFileSync(sciezka + ".token", token);

  // Ponowne wejscie na link - formularz ma byc zamkniety
  await page.goto(`${APP}/wniosek/${token}`);
  sprawdz(await page.getByText("Wniosek został już złożony").isVisible(), "ponowne wejście na link pokazuje 'już złożony', nie formularz");
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T2 autozapis niekompletnego wniosku (klient wpisał tylko nazwę)", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wpisz(page, "nazwa_firmy", "Tylko nazwa");
  const stan = await stanZapisu(page);
  sprawdz(stan === "zapisano", "wersja robocza zapisuje się mimo braku pozostałych pól", `wskaźnik: ${stan}`);
  const w = sql(`select nazwa_firmy from mienie_wnioski where form_token='${token}'`);
  sprawdz(w === "Tylko nazwa", "DB: nazwa zapisana w wersji roboczej", w);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T3 błędny NIP w trakcie wypełniania", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page, { nip: "1234567890" });
  await pole(page, "nip").blur();
  await page.waitForTimeout(300);
  sprawdz(await page.getByText("NIP ma niepoprawną sumę kontrolną").isVisible(), "komunikat o złym NIP przy polu");
  const stan = await stanZapisu(page);
  sprawdz(stan === "zapisano", "reszta danych i tak zapisuje się jako wersja robocza", `wskaźnik: ${stan}`);
  const w = sql(`select adres_siedziby from mienie_wnioski where form_token='${token}'`);
  sprawdz(w.includes("Złota 44"), "DB: pozostałe pola zapisane mimo złego NIP", w);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T4 próba złożenia pustego wniosku", async ({ page }) => {
  const token = await nowyWniosek(page);
  await krok(page, "Podsumowanie");
  await page.getByRole("button", { name: "Złóż wniosek" }).click();
  await page.waitForTimeout(2500);
  sprawdz(/\/wniosek\/[^/]+$/.test(page.url()), "nie przeszło do potwierdzenia");
  sprawdz(await page.getByText(/nie można złożyć/i).isVisible(), "komunikat, że wniosku nie można złożyć");
  sprawdz(await page.getByText("Podaj nazwę firmy lub imię i nazwisko").isVisible(), "przeniesiono na krok z pierwszym błędem i pokazano komunikat przy polu");
  const s = sql(`select status from mienie_wnioski where form_token='${token}'`);
  sprawdz(s === "roboczy", "DB: status nadal roboczy", s);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T5 wyścig zapisów: szybkie klikanie + autozapis", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Zapisz i dokończ później" }).click();
  }
  await dalej(page); await dalej(page); await dalej(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zapisz i dokończ później" }).click();
  await stanZapisu(page);
  await page.waitForTimeout(2000);
  const n = sql(`select count(*) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}'`);
  sprawdz(n === "3", "DB: dokładnie 3 lokalizacje, bez duplikatów po równoległych zapisach", `jest ${n}`);
  const nr = sql(`select string_agg(l.nr::text, ',' order by l.nr) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}'`);
  sprawdz(nr === "1,2,3", "DB: numeracja lokalizacji 1,2,3", nr);
  await page.reload();
  await page.waitForLoadState("networkidle");
  const kroki = await page.getByRole("navigation", { name: "Kroki wniosku" }).getByRole("button").count();
  sprawdz(kroki === 1 + 3 + 4, "po odświeżeniu formularz ma 3 lokalizacje (8 kroków)", `kroków: ${kroki}`);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T6 usunięcie środkowej lokalizacji z przypisanym sprzętem", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  await krok(page, "Lokalizacja 3");
  await wpisz(page, "lokalizacje.2.adres", "ul. Trzecia 3");
  await wpisz(page, "lokalizacje.2.suma_sprzet_medyczny", 50000);
  await krok(page, "Sprzęt medyczny");
  await page.getByRole("button", { name: "+ Dodaj urządzenie" }).click();
  await wybierz(page, "sprzet_medyczny.0.lokalizacja", 3);
  await wpisz(page, "sprzet_medyczny.0.nazwa", "Urządzenie w lok. 3");
  await wpisz(page, "sprzet_medyczny.0.wartosc", 50000);
  await krok(page, "Dane firmy");
  // usun lokalizacje 2 (srodkowa)
  await page.locator("text=Lokalizacja 2").locator("..").getByRole("button", { name: "Usuń" }).click();
  await stanZapisu(page);
  const nr = sql(`select string_agg(l.nr::text||':'||coalesce(l.adres,''), ' ; ' order by l.nr) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}'`);
  sprawdz(nr.startsWith("1:") && nr.includes("2:ul. Trzecia 3"), "DB: po usunięciu lokalizacje przenumerowane na 1,2 (dawna 3 -> 2)", nr);
  const przyp = sql(`select sprzet_medyczny->0->>'lokalizacja' from mienie_wnioski where form_token='${token}'`);
  sprawdz(przyp === "2", "DB: sprzęt z dawnej lokalizacji 3 wskazuje teraz na 2", `lokalizacja urządzenia: ${przyp}`);
  await krok(page, "Lokalizacja 2");
  sprawdz((await pole(page, "lokalizacje.1.adres").inputValue()) === "ul. Trzecia 3", "UI: krok 'Lokalizacja 2' pokazuje dawną trzecią");
  const kontrola = await page.locator("text=Sprzęt medyczny / estetyczny").first().locator("..").innerText().catch(() => "");
  sprawdz(!/różnica/.test(kontrola), "UI: kontrola spójności nie zgłasza fałszywej rozbieżności", kontrola);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T7 import Excela przez stronę i złożenie", async ({ page }) => {
  await page.goto(APP + "/");
  await page.locator('input[type=file][name="plik"]').setInputFiles(XLSX_WYPELNIONY);
  await page.getByRole("button", { name: "Wczytaj wniosek z pliku" }).click();
  await page.waitForURL(/\/wniosek\/[^/?]+\?zrodlo=excel/, { timeout: 30000 });
  const token = decodeURIComponent(page.url().split("/wniosek/")[1].split("?")[0]);
  sprawdz(await page.getByText(/Dane wczytaliśmy z Twojego arkusza/).isVisible(), "baner 'dane z arkusza'");
  sprawdz((await pole(page, "nazwa_firmy").inputValue()) === "Beauty Studio Aurora sp. z o.o.", "nazwa firmy z pliku w formularzu");
  const zr = sql(`select zrodlo, import_plik from mienie_wnioski where form_token='${token}'`);
  sprawdz(zr.startsWith("excel|"), "DB: zrodlo = excel, zapisana nazwa pliku", zr);
  await krok(page, "Podsumowanie");
  await zaznacz(page, "zgoda_prawdziwosc");
  await zaznacz(page, "zgoda_rodo");
  await page.getByRole("button", { name: "Złóż wniosek" }).click();
  await page.waitForURL(/\/zlozony$/, { timeout: 20000 });
  const r = sql(`select status, suma_lacznie from mienie_wnioski where form_token='${token}'`);
  sprawdz(r === "zlozony|1333000", "DB: wniosek z Excela złożony, suma 1 333 000", r);
  const n = sql(`select count(*) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}'`);
  sprawdz(n === "2", "DB: 2 lokalizacje z pliku", n);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T8 skrajne dane: minus, ogromne kwoty, długi tekst", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await wpisz(page, "stanowisko", "x".repeat(3000));
  await dalej(page);
  await wpisz(page, "lokalizacje.0.adres", "ul. Skrajna 1");
  await wpisz(page, "lokalizacje.0.suma_budynek", -5000);
  await pole(page, "lokalizacje.0.suma_budynek").blur();
  await wpisz(page, "lokalizacje.0.suma_wyposazenie", 999999999);
  await wpisz(page, "lokalizacje.0.powierzchnia", "");
  const stan = await stanZapisu(page);
  sprawdz(stan === "zapisano" || stan === "blad", "formularz nie zawiesza się przy skrajnych danych", stan);
  sprawdz(await page.getByText("Kwota nie może być ujemna").isVisible(), "komunikat o ujemnej kwocie od razu przy polu (po opuszczeniu pola)");
  await krok(page, "Podsumowanie");
  await zaznacz(page, "zgoda_prawdziwosc"); await zaznacz(page, "zgoda_rodo");
  await page.locator('input[type=checkbox][value="Mienie od ognia i zdarzeń losowych"]').check();
  await page.getByRole("button", { name: "Złóż wniosek" }).click();
  await page.waitForTimeout(3000);
  sprawdz(/\/wniosek\/[^/]+$/.test(page.url()), "złożenie z ujemną kwotą zablokowane");
  sprawdz(await page.getByText("Kwota nie może być ujemna").isVisible().catch(() => false), "po nieudanym złożeniu: przeniesiono do lokalizacji i komunikat widoczny przy polu");
  const s8 = sql(`select status from mienie_wnioski where form_token='${token}'`);
  sprawdz(s8 === "roboczy", "DB: wniosek z ujemną kwotą nie został złożony", s8);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T9 telefon (390x844): pełne złożenie", async ({ page, ctx }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await dalej(page);
  await wypelnijLokalizacje(page, 0, { suma_wyposazenie: 50000 });
  await krok(page, "Podsumowanie");
  await page.locator('input[type=checkbox][value="Mienie od ognia i zdarzeń losowych"]').check();
  await wpisz(page, "miejscowosc_podpisu", "Kraków");
  await zaznacz(page, "zgoda_prawdziwosc"); await zaznacz(page, "zgoda_rodo");
  await page.getByRole("button", { name: "Złóż wniosek" }).click();
  await page.waitForURL(/\/zlozony$/, { timeout: 20000 });
  const r = sql(`select status from mienie_wnioski where form_token='${token}'`);
  sprawdz(r === "zlozony", "DB: złożony z telefonu", r);
  const szer = await page.evaluate(() => document.documentElement.scrollWidth);
  sprawdz(szer <= 391, "brak poziomego przewijania na telefonie", `scrollWidth=${szer}`);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T10 import pliku z ostrzeżeniami (wartości spoza list, brak e-maila)", async ({ page }) => {
  await page.goto(APP + "/");
  await page.locator('input[type=file][name="plik"]').setInputFiles(XLSX_Z_OSTRZEZENIAMI);
  await page.getByRole("button", { name: "Wczytaj wniosek z pliku" }).click();
  await page.getByText(/wymaga uwagi/).waitFor({ timeout: 30000 });
  const lista = await page.locator("ul").first().innerText();
  sprawdz(/Fundacja/.test(lista) && /Kontener/.test(lista), "ostrzeżenia wymieniają obie wartości spoza list", lista.slice(0, 300));
  sprawdz(/email/i.test(lista), "ostrzeżenie o brakującym e-mailu", lista.slice(0, 300));
  await page.getByRole("button", { name: "Przejdź do wniosku i popraw" }).click();
  await page.waitForURL(/\/wniosek\//, { timeout: 20000 });
  sprawdz((await pole(page, "nazwa_firmy").inputValue()) === "Beauty Studio Aurora sp. z o.o.", "formularz otwiera się z danymi mimo ostrzeżeń");
  sprawdz((await pole(page, "forma_prawna").inputValue()) === "", "wartość spoza listy nie wchodzi do pola wyboru");
  await wpisz(page, "email_kontaktowy", "poprawiony@salon.pl");
  sprawdz((await stanZapisu(page)) === "zapisano", "poprawka zapisuje się");
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T11 ten sam wniosek w dwóch kartach naraz", async ({ page, ctx }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await page.getByRole("button", { name: "+ Dodaj lokalizację" }).click();
  await stanZapisu(page);
  const druga = await ctx.newPage();
  const bledyDrugiej = [];
  druga.on("pageerror", (e) => bledyDrugiej.push(e.message));
  await druga.goto(`${APP}/wniosek/${token}`);
  await druga.waitForLoadState("networkidle");
  // obie karty zapisuja jednoczesnie, kilka razy
  for (let i = 0; i < 5; i++) {
    await Promise.all([
      page.getByRole("button", { name: "Zapisz i dokończ później" }).click(),
      druga.getByRole("button", { name: "Zapisz i dokończ później" }).click(),
    ]);
  }
  await page.waitForTimeout(4000);
  const n = sql(`select count(*) from mienie_lokalizacje l join mienie_wnioski w on w.id=l.wniosek_id where w.form_token='${token}'`);
  sprawdz(n === "2", "DB: nadal dokładnie 2 lokalizacje po jednoczesnych zapisach z dwóch kart", `jest ${n}`);
  sprawdz(bledyDrugiej.length === 0, "druga karta bez błędów JS", bledyDrugiej.join(" | "));
  await page.reload(); await page.waitForLoadState("networkidle");
  const kroki = await page.getByRole("navigation", { name: "Kroki wniosku" }).getByRole("button").count();
  sprawdz(kroki === 1 + 2 + 4, "po odświeżeniu formularz spójny (6 kroków)", `kroków: ${kroki}`);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T12 data wpisana ręcznie jak w Safari (pole tekstowe)", async ({ page }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await krok(page, "Podsumowanie");

  /*
   * Chromium nie pozwala wpisac do pola daty nic poza RRRR-MM-DD (React przywraca
   * type="date", a przegladarka czysci wartosc przed odczytem). Safari bez obslugi
   * dat zostawia pole tekstowe i wysyla to, co klient wpisal. Podstawiamy wiec
   * wartosc w wysylanym zapisie - cala sciezka serwerowa (akcja, schemat,
   * konwersja, PostgREST, kolumna date) jest prawdziwa.
   */
  let podmiana = null;
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (podmiana !== null && r.method() === "POST" && r.headers()["next-action"]) {
      const cialo = (r.postData() ?? "").replace(/"data_podpisu":"[^"]*"/, `"data_podpisu":"${podmiana}"`);
      return route.continue({ postData: cialo });
    }
    return route.continue();
  });

  podmiana = "23.09.2026";
  await wpisz(page, "uwagi", "zapis z datą jak z Safari");
  sprawdz((await stanZapisu(page)) === "zapisano", "zapis przechodzi z datą w formacie 23.09.2026");
  const d1 = sql(`select coalesce(data_podpisu::text,'NULL') from mienie_wnioski where form_token='${token}'`);
  sprawdz(d1 === "2026-09-23", "DB: data przekonwertowana na 2026-09-23", d1);

  podmiana = "jutro";
  await wpisz(page, "uwagi", "zmiana po nieczytelnej dacie");
  sprawdz((await stanZapisu(page)) === "zapisano", "nieczytelna data nie wywraca zapisu całego wniosku");
  const [u, d2] = sql(`select uwagi, coalesce(data_podpisu::text,'NULL') from mienie_wnioski where form_token='${token}'`).split("|");
  sprawdz(u === "zmiana po nieczytelnej dacie", "DB: pozostałe pola zapisane mimo nieczytelnej daty", u);
  sprawdz(d2 === "NULL", "DB: nieczytelna data zapisana jako brak daty, nie jako błąd", d2);
  await page.unroute("**/*");
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T13 utrata zasięgu w trakcie wypełniania", async ({ page, ctx, bledy }) => {
  const token = await nowyWniosek(page);
  await wypelnijDaneFirmy(page);
  await stanZapisu(page);
  await ctx.setOffline(true);
  await wpisz(page, "osoba_kontaktu", "Wpisane bez zasięgu");
  await page.waitForTimeout(5000);
  const komunikat = await page.locator("body").innerText();
  sprawdz(/Nie zapisano|Brak połączenia/.test(komunikat), "klient widzi, że zapis się nie udał (nie ma fałszywego 'Zapisano')");
  sprawdz(await pole(page, "osoba_kontaktu").inputValue() === "Wpisane bez zasięgu", "wpisane dane zostają w formularzu");
  await ctx.setOffline(false);
  await wpisz(page, "stanowisko", "Po powrocie zasięgu");
  sprawdz((await stanZapisu(page)) === "zapisano", "po powrocie zasięgu zapis wraca sam przy następnej zmianie");
  const w = sql(`select osoba_kontaktu || ' / ' || stanowisko from mienie_wnioski where form_token='${token}'`);
  sprawdz(w === "Wpisane bez zasięgu / Po powrocie zasięgu", "DB: zapisane także to, co wpisano bez zasięgu", w);
  // bledy sieci przegladarki sa tu oczekiwane - liczy sie tylko brak wyjatkow JS
  for (let i = bledy.length - 1; i >= 0; i--) if (!bledy[i].startsWith("pageerror")) bledy.splice(i, 1);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T14 import złośliwych plików (bomby, XXE, makra, formuły, podmienione rozszerzenie)", async ({ page, bledy }) => {
  const katalog = mkdtempSync(path.join(tmpdir(), "zlosliwe-"));
  generujKorpus(katalog);

  // Pliki, ktore MUSZA zostac odrzucone bez utworzenia wniosku.
  const odrzucane = [
    "xxe.xlsx", "billion-laughs.xlsx", "zip-bomba.xlsx", "bomba-wierszy.xlsx",
    "makra-jako-xlsx.xlsx", "osadzony-obiekt.xlsx", "tysiace-wpisow.xlsx",
    "uszkodzony.xlsx", "za-duzy.xlsx", "exe-jako-xlsx.xlsx", "html-jako-xlsx.xlsx",
    "ole-jako-xlsx.xlsx",
  ];

  const przedWszystkie = Number(sql("select count(*) from mienie_wnioski"));

  for (const nazwa of odrzucane) {
    await page.goto(APP + "/");
    await page.locator('input[type=file][name="plik"]').setInputFiles(path.join(katalog, nazwa));
    await page.getByRole("button", { name: "Wczytaj wniosek z pliku" }).click();
    // Komunikat bledu ma sie pokazac, bez przekierowania do formularza.
    const blad = await page.locator(".text-red-600").first().innerText({ timeout: 15000 }).catch(() => "");
    sprawdz(blad.length > 0, `odrzucono: ${nazwa}`, blad.slice(0, 70) || "brak komunikatu");
    sprawdz(!/\/wniosek\//.test(page.url()), `brak przejścia do formularza: ${nazwa}`, page.url());
  }

  const poWszystkie = Number(sql("select count(*) from mienie_wnioski"));
  sprawdz(poWszystkie === przedWszystkie, "DB: żaden złośliwy plik nie utworzył wniosku", `${przedWszystkie} -> ${poWszystkie}`);

  // Formuly w tresci: plik jest poprawny strukturalnie, wiec zostaje przyjety,
  // ale wartosc „=cmd|…" ma byc zapisana DOSLOWNIE jako tekst — nie jako formula.
  await page.goto(APP + "/");
  await page.locator('input[type=file][name="plik"]').setInputFiles(path.join(katalog, "formuly-w-tresci.xlsx"));
  await page.getByRole("button", { name: "Wczytaj wniosek z pliku" }).click();
  // „=cmd|…" nie jest poprawnym e-mailem, wiec import konczy sie ekranem ostrzezen
  // — przechodzimy przez niego do formularza. Kluczowe: plik zostal przyjety.
  const doPoprawy = page.getByRole("button", { name: "Przejdź do wniosku i popraw" });
  await Promise.race([
    page.waitForURL(/\/wniosek\//, { timeout: 20000 }).catch(() => {}),
    doPoprawy.waitFor({ timeout: 20000 }).catch(() => {}),
  ]);
  if (await doPoprawy.isVisible().catch(() => false)) {
    await doPoprawy.click();
    await page.waitForURL(/\/wniosek\//, { timeout: 20000 });
  }
  sprawdz(/\/wniosek\//.test(page.url()), "plik z formułą w treści został przyjęty (poprawny strukturalnie)", page.url());
  const token = page.url().match(/wniosek\/([^/?]+)/)[1];
  const email = sql(`select coalesce(email_kontaktowy,'') from mienie_wnioski where form_token='${token}'`);
  sprawdz(email === "=cmd|' /C calc'!A0", "DB: formuła zapisana dosłownie jako tekst (nieuruchomiona)", email);
  // W formularzu wartosc widoczna doslownie, bez wykonania.
  const wpole = await pole(page, "email_kontaktowy").inputValue().catch(() => "");
  sprawdz(wpole === "=cmd|' /C calc'!A0", "formularz pokazuje formułę jako zwykły tekst", wpole);
}, browser);

// ---------------------------------------------------------------------------
await uruchom("T15 weryfikacja firmy w REGON (przycisk → akcja → odpowiedź)", async ({ page }) => {
  await nowyWniosek(page);
  await wpisz(page, "nip", "1111111111");
  await page.getByRole("button", { name: /Sprawdź firmę w REGON/ }).click();
  // Bez klucza produkcyjnego i przy zablokowanym połączeniu z GUS w środowisku
  // testowym oczekujemy albo karty z danymi, albo czytelnego komunikatu o
  // niedostępności — nigdy wyjątku ani zawieszenia formularza.
  const karta = page.getByText(/REGON:/);
  const blad = page.locator(".text-red-600");
  await Promise.race([
    karta.waitFor({ timeout: 30000 }).catch(() => {}),
    blad.first().waitFor({ timeout: 30000 }).catch(() => {}),
  ]);
  const odpowiedzial = (await karta.isVisible().catch(() => false)) || (await blad.first().isVisible().catch(() => false));
  sprawdz(odpowiedzial, "przycisk REGON zwraca wynik lub czytelny błąd, bez awarii");
  // Formularz nadal działa po weryfikacji.
  sprawdz((await pole(page, "nip").inputValue()) === "1111111111", "formularz zachowuje wpisany NIP po próbie weryfikacji");
}, browser);

await browser.close();

// ---------------------------------------------------------------------------
const nie = wyniki.filter((w) => !w.ok);
console.log(`\n==================== WYNIK: ${wyniki.length - nie.length}/${wyniki.length} PASS ====================`);
for (const w of nie) console.log(`FAIL [${w.scenariusz.split(" ")[0]}] ${w.opis}${w.szczegol ? ` -> ${w.szczegol}` : ""}`);
writeFileSync(path.join(TMP, "e2e-wynik.json"), JSON.stringify(wyniki, null, 2));
process.exit(nie.length ? 1 : 0);
