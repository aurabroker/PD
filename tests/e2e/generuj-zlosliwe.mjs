/**
 * Generator korpusu zlosliwych plikow .xlsx do scenariusza T14.
 *
 * Buduje pliki w podanym katalogu na podstawie szablonu i wypelnionego wniosku
 * z repozytorium. Kazdy plik odwzorowuje jeden wektor ataku przez import:
 * bomby dekompresyjne, encje XML (XXE / billion laughs), makra i obiekty
 * osadzone, formuly w tresci, podmienione rozszerzenie, uszkodzone archiwum,
 * plik za duzy i archiwum z tysiacami wpisow.
 *
 * Bez zaleznosci — wylacznie wbudowany `node:zlib`.
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const SZABLON = path.join(KATALOG, "..", "..", "public", "szablon", "wniosek-ubezpieczenie-majatkowe.xlsx");
const WYPELNIONY = path.join(KATALOG, "pliki", "wniosek-wypelniony.xlsx");

/** Odczyt wpisow ZIP (nazwa -> Buffer rozpakowany), po centralnym katalogu. */
function czytajZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("brak EOCD");
  const liczba = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const wpisy = [];
  for (let n = 0; n < liczba; n++) {
    const metoda = buf.readUInt16LE(p + 10);
    const rozmSpak = buf.readUInt32LE(p + 20);
    const dlNazwy = buf.readUInt16LE(p + 28);
    const dlExtra = buf.readUInt16LE(p + 30);
    const dlKom = buf.readUInt16LE(p + 32);
    const offLok = buf.readUInt32LE(p + 42);
    const nazwa = buf.toString("utf8", p + 46, p + 46 + dlNazwy);
    // dane z naglowka lokalnego
    const lokDlNazwy = buf.readUInt16LE(offLok + 26);
    const lokDlExtra = buf.readUInt16LE(offLok + 28);
    const start = offLok + 30 + lokDlNazwy + lokDlExtra;
    const spak = buf.subarray(start, start + rozmSpak);
    const dane = metoda === 0 ? Buffer.from(spak) : inflateRawSync(spak);
    wpisy.push({ nazwa, dane });
    p += 46 + dlNazwy + dlExtra + dlKom;
  }
  return wpisy;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

/** Zapis ZIP. store=true wymusza brak kompresji (na plik „za duzy"). */
function zapiszZip(wpisy, { store = false } = {}) {
  const lokalne = [];
  const centralne = [];
  let offset = 0;
  for (const w of wpisy) {
    const nazwa = Buffer.from(w.nazwa, "utf8");
    const dane = w.dane;
    const spak = store ? dane : deflateRawSync(dane);
    const metoda = store ? 0 : 8;
    const crc = crc32(dane);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(metoda, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(spak.length, 18);
    lh.writeUInt32LE(dane.length, 22);
    lh.writeUInt16LE(nazwa.length, 26);
    lokalne.push(lh, nazwa, spak);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(metoda, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(spak.length, 20);
    ch.writeUInt32LE(dane.length, 24);
    ch.writeUInt16LE(nazwa.length, 28);
    ch.writeUInt32LE(offset, 42);
    centralne.push(ch, nazwa);

    offset += lh.length + nazwa.length + spak.length;
  }
  const cialoCentralne = Buffer.concat(centralne);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(wpisy.length, 8);
  eocd.writeUInt16LE(wpisy.length, 10);
  eocd.writeUInt32LE(cialoCentralne.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokalne, cialoCentralne, eocd]);
}

const znajdz = (wpisy, nazwa) => wpisy.find((w) => w.nazwa === nazwa);
const kopia = (wpisy) => wpisy.map((w) => ({ nazwa: w.nazwa, dane: Buffer.from(w.dane) }));

function wstawPoDeklaracji(xml, wstawka) {
  const s = xml.toString("utf8");
  const i = s.indexOf("?>") + 2;
  return Buffer.from(s.slice(0, i) + wstawka + s.slice(i), "utf8");
}

export function generujKorpus(katalogWy) {
  mkdirSync(katalogWy, { recursive: true });
  const szablon = czytajZip(readFileSync(SZABLON));
  const wypelniony = czytajZip(readFileSync(WYPELNIONY));
  const wynik = {};
  const zapisz = (nazwa, buf) => {
    writeFileSync(path.join(katalogWy, nazwa), buf);
    wynik[nazwa] = buf.length;
  };

  // 1. XXE — encja zewnetrzna czytajaca plik z serwera.
  {
    const w = kopia(szablon);
    const ss = znajdz(w, "xl/sharedStrings.xml");
    ss.dane = wstawPoDeklaracji(ss.dane, '<!DOCTYPE sst [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>');
    zapisz("xxe.xlsx", zapiszZip(w));
  }
  // 2. Billion laughs — wykladnicze rozwiniecie encji.
  {
    const w = kopia(szablon);
    const ss = znajdz(w, "xl/sharedStrings.xml");
    let dtd = '<!DOCTYPE sst [<!ENTITY lol "lol">';
    for (let i = 1; i <= 9; i++) dtd += `<!ENTITY lol${i} "${`&lol${i === 1 ? "" : i - 1};`.repeat(10)}">`;
    dtd += "]>";
    ss.dane = wstawPoDeklaracji(ss.dane, dtd);
    zapisz("billion-laughs.xlsx", zapiszZip(w));
  }
  // 3. Bomba dekompresyjna — arkusz ~400 MB po rozpakowaniu.
  {
    const w = kopia(szablon);
    const sh = znajdz(w, "xl/worksheets/sheet10.xml");
    const s = sh.dane.toString("utf8");
    const i = s.indexOf("</sheetData>");
    sh.dane = Buffer.concat([Buffer.from(s.slice(0, i)), Buffer.alloc(400 * 1024 * 1024, 0x20), Buffer.from(s.slice(i))]);
    zapisz("zip-bomba.xlsx", zapiszZip(w));
  }
  // 3b. Bomba wierszy — 3 mln komorek (CPU/pamiec parsera).
  {
    const w = kopia(szablon);
    const sh = znajdz(w, "xl/worksheets/sheet2.xml");
    const s = sh.dane.toString("utf8");
    const i = s.indexOf("</sheetData>");
    sh.dane = Buffer.from(s.slice(0, i) + '<row><c t="s"><v>0</v></c></row>'.repeat(3_000_000) + s.slice(i), "utf8");
    zapisz("bomba-wierszy.xlsx", zapiszZip(w));
  }
  // 4. Makra VBA w pliku przemianowanym na .xlsx.
  {
    const w = kopia(wypelniony);
    const ct = znajdz(w, "[Content_Types].xml");
    ct.dane = Buffer.from(
      ct.dane.toString("utf8").replace("</Types>", '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'),
      "utf8",
    );
    w.push({ nazwa: "xl/vbaProject.bin", dane: Buffer.from("\xd0\xcf\x11\xe0Sub Workbook_Open()\nShell \"calc.exe\"\nEnd Sub\n", "binary") });
    zapisz("makra-jako-xlsx.xlsx", zapiszZip(w));
  }
  // 5. Obiekt OLE / ActiveX osadzony.
  {
    const w = kopia(wypelniony);
    w.push({ nazwa: "xl/embeddings/oleObject1.bin", dane: Buffer.from("\xd0\xcf\x11\xe0payload", "binary") });
    w.push({ nazwa: "xl/activeX/activeX1.xml", dane: Buffer.from("<ax/>", "utf8") });
    zapisz("osadzony-obiekt.xlsx", zapiszZip(w));
  }
  // 6. Formuly i DDE jako TEKST w polu wartosci (wektor na eksport do arkusza).
  // Wypelniony wniosek trzyma wartosci jako inline string w arkuszach; podmieniamy
  // e-mail na lancuch formuly. Plik jest poprawny strukturalnie — ma zostac przyjety,
  // a eksport ma go pokazac doslownie (komorka tekstowa), nigdy jako formule.
  {
    const w = kopia(wypelniony);
    const trucizna = "=cmd|' /C calc'!A0";
    for (const sh of w) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(sh.nazwa)) {
        sh.dane = Buffer.from(sh.dane.toString("utf8").replace("kontakt@aurora-beauty.pl", trucizna), "utf8");
      }
    }
    zapisz("formuly-w-tresci.xlsx", zapiszZip(w));
  }
  // 7. Plik wykonywalny przemianowany na .xlsx (naglowek MZ).
  zapisz("exe-jako-xlsx.xlsx", Buffer.concat([Buffer.from("MZ\x90\x00", "binary"), Buffer.alloc(4000, 7)]));
  // 8. HTML przemianowany na .xlsx.
  zapisz("html-jako-xlsx.xlsx", Buffer.from("<html><script>alert(1)</script></html>", "utf8"));
  // 9. Kontener OLE2 (stary .xls / zaszyfrowany) przemianowany na .xlsx.
  zapisz("ole-jako-xlsx.xlsx", Buffer.concat([Buffer.from("\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "binary"), Buffer.alloc(8000, 3)]));
  // 10. Uciete archiwum ZIP.
  {
    const pelny = readFileSync(SZABLON);
    zapisz("uszkodzony.xlsx", pelny.subarray(0, Math.floor(pelny.length / 2)));
  }
  // 11. Plik wiekszy niz 1 MB (nieskompresowalny, zip „stored").
  zapisz("za-duzy.xlsx", zapiszZip([{ nazwa: "x.bin", dane: randomBytes(1_300_000) }], { store: true }));
  // 12. Archiwum z tysiacami wpisow.
  {
    const w = kopia(szablon);
    for (let i = 0; i < 6000; i++) w.push({ nazwa: `xl/media/p${i}`, dane: Buffer.alloc(0) });
    zapisz("tysiace-wpisow.xlsx", zapiszZip(w));
  }
  return wynik;
}

// Uruchomienie bezposrednie: node generuj-zlosliwe.mjs <katalog>
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const wy = process.argv[2] ?? path.join(KATALOG, "pliki-zlosliwe");
  const r = generujKorpus(wy);
  console.log("Zapisano do", wy);
  for (const [n, s] of Object.entries(r)) console.log(`  ${n.padEnd(26)} ${s} B`);
}
