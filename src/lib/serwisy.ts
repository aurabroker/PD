/** Sekcja „Nasze serwisy” — pozostałe serwisy grupy Aura Expert (dane od właściciela). */
export const SEKCJA_SERWISOW = {
  id: "serwisy",
  eyebrow: "Nasze serwisy",
  title: "Poznaj pozostałe serwisy Aura Expert",
  intro: "Wyspecjalizowane rozwiązania w ramach grupy Aura Expert — dla przedsiębiorców, zespołów i branż.",
} as const;

export type Serwis = {
  label: string;
  desc: string;
  href: string | null;
  img: string;
  /** „facet” — zdjęcie osoby (kadrowane), „logo” — logotyp na białym tle. */
  kind: "facet" | "logo";
  soon?: boolean;
};

export const SERWISY: readonly Serwis[] = [
  {
    label: "utratadochodu.pl",
    desc: "Ochrona dochodu dla wolnych zawodów",
    href: "https://utratadochodu.pl",
    img: "https://auraexpert.pl/images/services/utratadochodu.png",
    kind: "facet",
  },
  {
    label: "ERGO Grupa Otwarta",
    desc: "Ubezpieczenia grupowe ERGO",
    href: "https://ergo.beautypolisa.eu",
    img: "https://auraexpert.pl/images/services/ergo.png",
    kind: "logo",
  },
  {
    label: "Grupowe Pakiety Branżowe",
    desc: "Pakiety ubezpieczeń dla branż",
    href: "https://ergo.auraexpert.pl/",
    img: "https://auraexpert.pl/images/services/ergo.png",
    kind: "logo",
  },
  {
    label: "Beauty Polisa",
    desc: "Ochrona salonów i gabinetów",
    href: null,
    img: "https://auraexpert.pl/images/beautypolisa.png",
    kind: "logo",
    soon: true,
  },
];
