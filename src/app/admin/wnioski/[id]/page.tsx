import { notFound } from "next/navigation";
import { pobierzWniosekPoId } from "@/lib/wnioski";
import { kontrolaSpojnosci, sumaLokalizacji, sumaWniosku } from "@/lib/schema";
import { zl } from "@/lib/format";
import { POZYCJE_SUM, STATUS_ETYKIETY } from "@/lib/slowniki";
import { jestBrak, tytulLokalizacji } from "@/lib/porzadkowanie";
import PanelAgenta from "@/components/PanelAgenta";
import { biezacyAgent } from "@/lib/autoryzacja";
import { historiaWniosku, type WpisHistorii } from "@/lib/historia";
import { nazwaAgenta, pobierzAgentow, type AgentSkrot } from "@/lib/statystyki";

export const dynamic = "force-dynamic";

export default async function SzczegolyWniosku({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wynik = await pobierzWniosekPoId(id);
  if (!wynik) notFound();

  const { meta, dane } = wynik;
  const [sesja, agenci, historia] = await Promise.all([biezacyAgent(), pobierzAgentow(), historiaWniosku(meta.id)]);
  const poId = new Map(agenci.map((a) => [a.user_id, a]));
  const kontrola = kontrolaSpojnosci(dane);
  const rozbieznosci = kontrola.filter((k) => !k.zgodnyMedyczny || !k.zgodnyEei);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <a href="/admin" className="text-sm text-stone-500 hover:text-marka-700">← Wszystkie wnioski</a>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.nr_referencyjny}</h1>
          <p className="mt-1 text-stone-600">{dane.nazwa_firmy}</p>
        </div>
        <div className="flex gap-2">
          {meta.status !== "roboczy" && (
            <a href={`/api/wniosek/${meta.form_token}/pdf`} className="przycisk-drugi">
              Pobierz PDF
            </a>
          )}
          {(dane.sprzet_medyczny.length > 0 || dane.elektronika_eei.length > 0) && (
            <a href={`/api/admin/wnioski/${meta.id}/sprzet`} className="przycisk-drugi"
              title="Wykaz sprzętu medycznego i elektroniki — do zapytania ofertowego">
              Wykaz sprzętu (.xlsx)
            </a>
          )}
          <a href={`/api/wniosek/${meta.form_token}/excel`} className="przycisk-drugi">
            Pobierz .xlsx
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {rozbieznosci.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-900">
                Rozbieżności między wykazem sprzętu a sumami ubezpieczenia
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {rozbieznosci.map((k) => (
                  <li key={k.nr}>
                    <strong>Lokalizacja {k.nr}:</strong>
                    {!k.zgodnyMedyczny && (
                      <> sprzęt medyczny — wykaz {zl(k.wykazMedyczny)}, deklarowane {zl(k.deklarowanyMedyczny)}.</>
                    )}
                    {!k.zgodnyEei && (
                      <> elektronika — wykaz {zl(k.wykazEei)}, deklarowane {zl(k.deklarowanyEei)}.</>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Karta tytul="Dane ubezpieczającego">
            <Siatka pozycje={[
              ["Nazwa", dane.nazwa_firmy],
              ["NIP", dane.nip],
              ["REGON", dane.regon],
              ["KRS", dane.krs],
              ["Forma prawna", dane.forma_prawna],
              ["PKD", dane.numer_pkd],
              ["Adres siedziby", dane.adres_siedziby],
              ["E-mail", dane.email_kontaktowy],
              ["Telefon", dane.telefon],
              ["Osoba do kontaktu", [dane.osoba_kontaktu, dane.stanowisko].filter(Boolean).join(", ")],
              ["Rodzaj działalności", dane.rodzaj_dzialalnosci],
              ["Pracownicy", dane.liczba_pracownikow],
              ["Roczny obrót", dane.roczny_obrot],
            ]} />
          </Karta>

          {dane.lokalizacje.map((lok) => (
            <Karta key={lok.nr} tytul={tytulLokalizacji(lok)}>
              <Siatka pozycje={[
                ["Adres", lok.adres],
                ["Typ lokalu", lok.typ_lokalu],
                ["Powierzchnia", lok.powierzchnia ? `${lok.powierzchnia} m²` : ""],
                ["Piętro", lok.pietro],
                ["Rok budowy / remontu", [lok.rok_budowy, lok.rok_remontu].filter(Boolean).join(" / ")],
                ["Ściany / dach", [lok.material_scian, lok.pokrycie_dachu].filter(Boolean).join(" / ")],
                ["Stan techniczny", lok.stan_techniczny],
                ["Ogrzewanie", lok.ogrzewanie],
                ["Własność", lok.budynek_wlasny ? "budynek własny" : "najem"],
              ]} />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Lista tytul="Zabezpieczenia ppoż." pozycje={[
                  lok.gasnice_szt && `gaśnice: ${lok.gasnice_szt} szt.`,
                  lok.hydranty && "hydranty wewnętrzne",
                  lok.sap && "system alarmowania pożaru",
                  lok.tryskacze && "tryskacze",
                  lok.drogi_ewakuacyjne && "oznakowane drogi ewakuacyjne",
                  lok.zakaz_palenia && "zakaz palenia",
                  lok.odleglosc_psp && `PSP: ${lok.odleglosc_psp} km`,
                  lok.materialy_palne && "materiały palne w procesie",
                ]} />
                <Lista tytul="Zabezpieczenia antykradzieżowe" pozycje={[
                  lok.alarm_typ && lok.alarm_typ !== "brak" && `alarm: ${lok.alarm_typ}`,
                  lok.agencja_ochrony && !jestBrak(lok.agencja_ochrony) && `ochrona: ${lok.agencja_ochrony}`,
                  lok.agencja_24h && "ochrona 24h",
                  lok.cctv && "monitoring CCTV",
                  lok.sejf_klasa && lok.sejf_klasa !== "brak" && `sejf kl. ${lok.sejf_klasa}`,
                  lok.kraty && "kraty w oknach",
                  lok.rolety && "rolety antywłamaniowe",
                  lok.zamki_atestowane && "zamki atestowane",
                  lok.drzwi_atestowane && "drzwi atestowane",
                  lok.szyby_antywlamaniowe && "szyby antywłamaniowe",
                  lok.ogrodzenie && "ogrodzenie terenu",
                  lok.system_alarmowy && "komputerowy system alarmowy",
                ]} />
              </div>

              <div className="mt-4 flex justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-sm">
                <span className="text-stone-600">Suma lokalizacji</span>
                <span className="font-medium tabular-nums">{zl(sumaLokalizacji(lok))}</span>
              </div>
            </Karta>
          ))}

          <Karta tytul="Suma ubezpieczenia">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="pb-2 font-medium">Kategoria</th>
                  {dane.lokalizacje.map((l) => (
                    <th key={l.nr} className="pb-2 text-right font-medium">Lok. {l.nr}</th>
                  ))}
                  <th className="pb-2 text-right font-medium">Razem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {POZYCJE_SUM.map((poz) => {
                  const wartosci = dane.lokalizacje.map((l) => Number(l[poz.klucz]) || 0);
                  const razem = wartosci.reduce((a, b) => a + b, 0);
                  if (razem === 0) return null;
                  return (
                    <tr key={poz.klucz}>
                      <td className="py-2 text-stone-700">{poz.etykieta}</td>
                      {wartosci.map((w, i) => (
                        <td key={i} className="py-2 text-right tabular-nums text-stone-600">{zl(w)}</td>
                      ))}
                      <td className="py-2 text-right font-medium tabular-nums">{zl(razem)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300">
                  <td className="pt-3 font-medium">Łącznie</td>
                  <td colSpan={dane.lokalizacje.length} />
                  <td className="pt-3 text-right text-lg font-semibold tabular-nums">
                    {zl(sumaWniosku(dane))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Karta>

          {dane.sprzet_medyczny.length > 0 && (
            <Karta tytul={`Sprzęt medyczny (${dane.sprzet_medyczny.length})`}>
              <TabelaSprzetu pozycje={dane.sprzet_medyczny.map((u) => ({
                lokalizacja: u.lokalizacja,
                opis: [u.nazwa, u.producent, u.model].filter(Boolean).join(" · "),
                dodatkowe: [u.nr_seryjny, u.rok_zakupu, u.cert_ce ? "CE" : ""].filter(Boolean).join(" · "),
                wartosc: u.wartosc,
              }))} />
            </Karta>
          )}

          {dane.elektronika_eei.length > 0 && (
            <Karta tytul={`Elektronika EEI (${dane.elektronika_eei.length})`}>
              <TabelaSprzetu pozycje={dane.elektronika_eei.map((u) => ({
                lokalizacja: u.lokalizacja,
                opis: [u.nazwa, u.producent, u.model].filter(Boolean).join(" · "),
                dodatkowe: [u.nr_seryjny, u.rok_zakupu].filter(Boolean).join(" · "),
                wartosc: u.wartosc,
              }))} />
            </Karta>
          )}

          <Karta tytul="Szkodowość">
            {dane.brak_szkod ? (
              <p className="text-sm text-stone-600">Brak szkód w ostatnich 5 latach.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Przyczyna</th>
                    <th className="pb-2 font-medium">Ubezpieczyciel</th>
                    <th className="pb-2 text-right font-medium">Szkoda</th>
                    <th className="pb-2 text-right font-medium">Odszkodowanie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dane.szkody.map((s, i) => (
                    <tr key={i}>
                      <td className="py-2">{s.data}</td>
                      <td className="py-2 text-stone-700">{s.przyczyna}</td>
                      <td className="py-2 text-stone-600">{s.ubezpieczyciel}</td>
                      <td className="py-2 text-right tabular-nums">{zl(s.kwota_szkody)}</td>
                      <td className="py-2 text-right tabular-nums">{zl(s.odszkodowanie)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Karta>

          {(dane.posiada_polise || dane.uwagi) && (
            <Karta tytul="Dotychczasowa polisa i uwagi">
              {dane.posiada_polise && (
                <Siatka pozycje={[
                  ["Towarzystwo", dane.towarzystwo_obecne],
                  ["Numer polisy", dane.nr_polisy_obecny],
                  ["Ważność do", dane.waznosc_do],
                  ["Roczna składka", dane.roczna_skladka_obecna ? zl(dane.roczna_skladka_obecna) : ""],
                ]} />
              )}
              {dane.uwagi && (
                <p className="mt-4 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                  {dane.uwagi}
                </p>
              )}
            </Karta>
          )}

          <Historia wpisy={historia} agenci={poId} />
        </div>

        <PanelAgenta
          id={meta.id}
          status={meta.status}
          uwagiAgenta={meta.uwagi_agenta ?? ""}
          linkKlienta={`/wniosek/${meta.form_token}`}
          tokenWygasa={meta.token_wygasa}
          zrodlo={meta.zrodlo}
          importPlik={meta.import_plik}
          zgodnosc={meta.import_zgodnosc ?? null}
          przypisanyAgent={meta.przypisany_agent ?? null}
          agenci={agenci.filter((a) => a.aktywny).map((a) => ({ user_id: a.user_id, nazwa: nazwaAgenta(a) }))}
          ja={{ user_id: sesja!.agent.user_id, admin: sesja!.agent.rola === "admin" }}
          oferta={{
            oferta_towarzystwo: meta.oferta_towarzystwo ?? null,
            oferta_skladka: meta.oferta_skladka ?? null,
            polisa_numer: meta.polisa_numer ?? null,
            polisa_skladka: meta.polisa_skladka ?? null,
            polisa_od: meta.polisa_od ?? null,
            polisa_do: meta.polisa_do ?? null,
            rezygnacja_powod: meta.rezygnacja_powod ?? null,
          }}
          utworzony={meta.created_at}
          wyslany={meta.wyslano_at}
          zakres={dane.zakres}
          zgody={{ prawdziwosc: dane.zgoda_prawdziwosc, rodo: dane.zgoda_rodo }}
        />
      </div>
    </main>
  );
}

function Karta({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="naglowek-sekcji">{tytul}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Siatka({ pozycje }: { pozycje: [string, string | number | null | undefined][] }) {
  const widoczne = pozycje.filter(([, v]) => v !== "" && v != null);
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {widoczne.map(([etykieta, wartosc]) => (
        <div key={etykieta}>
          <dt className="text-xs uppercase tracking-wide text-stone-400">{etykieta}</dt>
          <dd className="mt-0.5 text-sm text-stone-800">{wartosc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lista({ tytul, pozycje }: { tytul: string; pozycje: (string | false | undefined)[] }) {
  const widoczne = pozycje.filter(Boolean) as string[];
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{tytul}</p>
      {widoczne.length === 0 ? (
        <p className="mt-1 text-sm text-stone-400">brak</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
          {widoczne.map((p) => <li key={p}>· {p}</li>)}
        </ul>
      )}
    </div>
  );
}

function TabelaSprzetu({
  pozycje,
}: {
  pozycje: { lokalizacja: number; opis: string; dodatkowe: string; wartosc: number }[];
}) {
  const suma = pozycje.reduce((a, p) => a + (Number(p.wartosc) || 0), 0);
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-stone-100">
        {pozycje.map((p, i) => (
          <tr key={i}>
            <td className="py-2 pr-2 text-xs text-stone-400">Lok. {p.lokalizacja}</td>
            <td className="py-2">
              <span className="block text-stone-800">{p.opis}</span>
              {p.dodatkowe && <span className="text-xs text-stone-400">{p.dodatkowe}</span>}
            </td>
            <td className="py-2 text-right tabular-nums">{zl(p.wartosc)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-stone-200">
          <td colSpan={2} className="pt-2 text-sm font-medium">Razem</td>
          <td className="pt-2 text-right font-medium tabular-nums">{zl(suma)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Oś zdarzeń wniosku: złożenie, zmiany statusu, przydziały — kto i kiedy. */
function Historia({ wpisy, agenci }: { wpisy: WpisHistorii[]; agenci: Map<string, AgentSkrot> }) {
  if (wpisy.length === 0) return null;
  const kto = (id: string | null) => (id ? nazwaAgenta(agenci.get(id)) : "klient");
  const etykieta = (s: unknown) => STATUS_ETYKIETY[s as keyof typeof STATUS_ETYKIETY] ?? String(s ?? "—");
  const opis = (w: WpisHistorii) => {
    const d = w.szczegoly as Record<string, unknown>;
    switch (w.zdarzenie) {
      case "zlozenie":
        return "Klient złożył wniosek";
      case "status": {
        const extra = [
          d.oferta_towarzystwo && `${d.oferta_towarzystwo}`,
          d.oferta_skladka && `składka ${zl(Number(d.oferta_skladka))}`,
          d.polisa_numer && `polisa ${d.polisa_numer}`,
          d.polisa_skladka && `składka ${zl(Number(d.polisa_skladka))}`,
          d.rezygnacja_powod && `powód: ${d.rezygnacja_powod}`,
        ].filter(Boolean);
        return `Status: ${etykieta(d.z)} → ${etykieta(d.na)}${extra.length ? ` (${extra.join(", ")})` : ""}`;
      }
      case "przydzial":
        return d.na ? `Przypisano: ${kto(String(d.na))}${d.przejecie ? " (przejęcie przy obsłudze)" : ""}` : "Zwrócono do puli";
      default:
        return w.zdarzenie;
    }
  };

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6" aria-label="Historia wniosku">
      <h2 className="text-base font-semibold">Historia</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {wpisy.map((w) => (
          <li key={w.id} className="flex flex-wrap gap-x-3 border-l-2 border-stone-200 pl-3">
            <time className="w-32 shrink-0 text-xs tabular-nums text-stone-400">
              {new Date(w.created_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" })}
            </time>
            <span className="text-stone-800">{opis(w)}</span>
            <span className="text-xs text-stone-400">— {kto(w.kto)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
