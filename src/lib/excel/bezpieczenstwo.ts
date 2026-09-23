import "server-only";

/**
 * Kontrola bezpieczenstwa pliku .xlsx PRZED oddaniem go do ExcelJS.
 *
 * Plik .xlsx to archiwum ZIP z plikami XML. Zanim biblioteka go rozpakuje,
 * sami czytamy strukture ZIP-a i odrzucamy wszystko, co nie wyglada na czysty
 * wniosek: bomby dekompresyjne (maly plik, gigantyczna zawartosc), makra,
 * obiekty osadzone, linki zewnetrzne, encje XML (XXE / billion laughs),
 * pliki zaszyfrowane i po prostu za duze.
 *
 * Dziala w srodowisku Workera (workerd) — korzysta wylacznie z Web API
 * (DataView, DecompressionStream, TextDecoder), bez Node/Buffer.
 */

/** Blad kontroli — komunikat jest bezpieczny do pokazania uzytkownikowi. */
export class BladPliku extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = "BladPliku";
  }
}

/** Surowy plik nie moze byc wiekszy niz 1 MB — wypelniony szablon ma ~130 KB. */
const MAX_ROZMIAR_PLIKU = 1 * 1024 * 1024;
/** Suma rozpakowanej zawartosci — czysty wniosek to <1 MB, dajemy duzy zapas. */
const MAX_ROZPAKOWANE = 24 * 1024 * 1024;
/** Liczba plikow w archiwum — szablon ma ~20; 128 to bezpieczny sufit. */
const MAX_WPISOW = 128;

/** Wpisy, ktorych czysty wniosek nigdy nie zawiera — nosniki kodu i tresci aktywnej. */
const ZABRONIONE_PREFIKSY = [
  "xl/vbaproject.bin", // makra VBA
  "xl/macrosheets/", // arkusze makr Excel 4.0
  "xl/activex", // kontrolki ActiveX
  "xl/embeddings/", // osadzone obiekty OLE
  "xl/externallinks/", // linki do zewnetrznych skoroszytow
  "customui/", // wstazka z akcjami
  "xl/drawings/vmldrawing", // stara grafika VML (nosnik skryptu)
];

/** Wpisy wymagane w kazdym prawidlowym .xlsx. */
const WYMAGANE_WPISY = ["[content_types].xml", "xl/workbook.xml"];

type WpisZip = {
  nazwa: string;
  metoda: number; // 0 = przechowany, 8 = deflate
  flagi: number;
  rozmiarSpakowany: number;
  rozmiarRozpakowany: number;
  offsetLokalny: number;
};

function odczytajCentralnyKatalog(dv: DataView): WpisZip[] {
  const dlugosc = dv.byteLength;

  // End Of Central Directory: sygnatura 0x06054b50, szukamy od konca.
  const SYG_EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = dlugosc - 22; i >= 0 && i >= dlugosc - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === SYG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new BladPliku("To nie jest prawidłowy plik .xlsx (uszkodzone archiwum).");
  }

  const liczbaWpisow = dv.getUint16(eocd + 10, true);
  const offsetKatalogu = dv.getUint32(eocd + 16, true);

  if (liczbaWpisow > MAX_WPISOW) {
    throw new BladPliku("Plik zawiera zbyt wiele elementów — to nie wygląda na wniosek.");
  }
  // Zip64 (rozmiary/offsety ustawione na 0xFFFFFFFF) — odrzucamy jako podejrzane.
  if (offsetKatalogu === 0xffffffff || liczbaWpisow === 0xffff) {
    throw new BladPliku("Nietypowa struktura pliku — odrzucono ze względów bezpieczeństwa.");
  }

  const SYG_CD = 0x02014b50;
  const wpisy: WpisZip[] = [];
  let p = offsetKatalogu;
  for (let n = 0; n < liczbaWpisow; n++) {
    if (p + 46 > dlugosc || dv.getUint32(p, true) !== SYG_CD) {
      throw new BladPliku("To nie jest prawidłowy plik .xlsx (uszkodzone archiwum).");
    }
    const flagi = dv.getUint16(p + 8, true);
    const metoda = dv.getUint16(p + 10, true);
    const rozmiarSpakowany = dv.getUint32(p + 20, true);
    const rozmiarRozpakowany = dv.getUint32(p + 24, true);
    const dlNazwy = dv.getUint16(p + 28, true);
    const dlExtra = dv.getUint16(p + 30, true);
    const dlKomentarz = dv.getUint16(p + 32, true);
    const offsetLokalny = dv.getUint32(p + 42, true);

    const bajtyNazwy = new Uint8Array(dv.buffer, dv.byteOffset + p + 46, dlNazwy);
    const nazwa = new TextDecoder("utf-8").decode(bajtyNazwy);

    wpisy.push({ nazwa, metoda, flagi, rozmiarSpakowany, rozmiarRozpakowany, offsetLokalny });
    p += 46 + dlNazwy + dlExtra + dlKomentarz;
  }
  return wpisy;
}

/** Odczyt danych spakowanych wpisu na podstawie naglowka lokalnego. */
function danePakietu(dv: DataView, wpis: WpisZip): Uint8Array {
  const p = wpis.offsetLokalny;
  const SYG_LOKALNY = 0x04034b50;
  if (p + 30 > dv.byteLength || dv.getUint32(p, true) !== SYG_LOKALNY) {
    throw new BladPliku("To nie jest prawidłowy plik .xlsx (uszkodzone archiwum).");
  }
  const dlNazwy = dv.getUint16(p + 26, true);
  const dlExtra = dv.getUint16(p + 28, true);
  const start = p + 30 + dlNazwy + dlExtra;
  return new Uint8Array(dv.buffer, dv.byteOffset + start, wpis.rozmiarSpakowany);
}

/** Rozpakowanie wpisu ze strumieniowym limitem — chroni przed klamliwym naglowkiem. */
async function rozpakujZLimitem(spakowane: Uint8Array, metoda: number, limit: number): Promise<Uint8Array> {
  if (metoda === 0) {
    if (spakowane.byteLength > limit) {
      throw new BladPliku("Zawartość pliku jest zbyt duża — odrzucono ze względów bezpieczeństwa.");
    }
    return spakowane;
  }
  if (metoda !== 8) {
    throw new BladPliku("Nieobsługiwana kompresja w pliku — odrzucono ze względów bezpieczeństwa.");
  }

  const strumien = new Blob([spakowane as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const czytnik = strumien.getReader();
  const czesci: Uint8Array[] = [];
  let razem = 0;
  for (;;) {
    const { done, value } = await czytnik.read();
    if (done) break;
    razem += value.byteLength;
    if (razem > limit) {
      await czytnik.cancel();
      throw new BladPliku("Zawartość pliku jest zbyt duża — odrzucono ze względów bezpieczeństwa.");
    }
    czesci.push(value);
  }
  const wynik = new Uint8Array(razem);
  let off = 0;
  for (const c of czesci) {
    wynik.set(c, off);
    off += c.byteLength;
  }
  return wynik;
}

/**
 * Sprawdza plik. Rzuca BladPliku przy jakimkolwiek naruszeniu.
 * Po pomyslnym przejsciu bufor mozna bezpiecznie oddac do ExcelJS.
 */
export async function sprawdzPlikXlsx(bufor: ArrayBuffer): Promise<void> {
  if (bufor.byteLength === 0) {
    throw new BladPliku("Plik jest pusty.");
  }
  if (bufor.byteLength > MAX_ROZMIAR_PLIKU) {
    throw new BladPliku("Plik jest większy niż 1 MB — to nie wygląda na wniosek.");
  }

  const dv = new DataView(bufor);
  // Sygnatura ZIP: PK\x03\x04. Odsiewa .exe, .html, stare .xls (OLE2), zmienione rozszerzenie.
  if (dv.byteLength < 4 || dv.getUint32(0, true) !== 0x04034b50) {
    throw new BladPliku("To nie jest plik .xlsx. Zapisz wniosek w Excelu jako .xlsx i spróbuj ponownie.");
  }

  const wpisy = odczytajCentralnyKatalog(dv);

  const nazwy = new Set(wpisy.map((w) => w.nazwa.toLowerCase()));
  for (const wymagany of WYMAGANE_WPISY) {
    if (!nazwy.has(wymagany)) {
      throw new BladPliku("Plik nie jest prawidłowym skoroszytem .xlsx.");
    }
  }

  let sumaRozpakowana = 0;
  for (const w of wpisy) {
    const nazwa = w.nazwa.toLowerCase();

    // Sciezki wychodzace poza archiwum.
    if (nazwa.includes("..") || nazwa.startsWith("/")) {
      throw new BladPliku("Nietypowa struktura pliku — odrzucono ze względów bezpieczeństwa.");
    }
    // Zaszyfrowany wpis: bit 0 flag ogolnego przeznaczenia.
    if (w.flagi & 0x0001) {
      throw new BladPliku("Plik jest zaszyfrowany hasłem — zapisz go bez hasła i spróbuj ponownie.");
    }
    // Nosniki kodu / tresci aktywnej.
    if (ZABRONIONE_PREFIKSY.some((prefiks) => nazwa.startsWith(prefiks))) {
      throw new BladPliku(
        "Plik zawiera makra lub obiekty osadzone. Wyślij czysty szablon wniosku bez makr (.xlsx, nie .xlsm).",
      );
    }
    sumaRozpakowana += w.rozmiarRozpakowany;
  }
  // Szybkie odrzucenie na podstawie zadeklarowanych rozmiarow (bomba dekompresyjna).
  if (sumaRozpakowana > MAX_ROZPAKOWANE) {
    throw new BladPliku("Zawartość pliku jest zbyt duża — odrzucono ze względów bezpieczeństwa.");
  }

  // Weryfikacja rzeczywista: rozpakowujemy strumieniowo z twardym limitem
  // (naglowek moze klamac o rozmiarze) i skanujemy XML pod katem encji.
  const dekoder = new TextDecoder("utf-8", { fatal: false });
  let budzetRozpakowania = MAX_ROZPAKOWANE;
  for (const w of wpisy) {
    const spakowane = danePakietu(dv, w);
    const rozpakowane = await rozpakujZLimitem(spakowane, w.metoda, budzetRozpakowania);
    budzetRozpakowania -= rozpakowane.byteLength;
    if (budzetRozpakowania < 0) {
      throw new BladPliku("Zawartość pliku jest zbyt duża — odrzucono ze względów bezpieczeństwa.");
    }

    if (w.nazwa.toLowerCase().endsWith(".xml") || w.nazwa.toLowerCase().endsWith(".rels")) {
      // Skan tylko poczatku wystarcza — DOCTYPE/ENTITY musza stac przed danymi.
      const naglowek = dekoder.decode(rozpakowane.subarray(0, Math.min(rozpakowane.byteLength, 65536)));
      if (/<!DOCTYPE/i.test(naglowek) || /<!ENTITY/i.test(naglowek)) {
        throw new BladPliku("Plik zawiera niedozwolone deklaracje XML — odrzucono ze względów bezpieczeństwa.");
      }
    }
  }
}
