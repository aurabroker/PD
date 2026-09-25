import FormularzImportu from "@/components/FormularzImportu";
import PrzyciskNowyWniosek from "@/components/PrzyciskNowyWniosek";
import SerwisyAura from "@/components/SerwisyAura";

const ATUTY = [
  "Zapis w trakcie wypełniania — wrócisz, kiedy chcesz",
  "Kopia wniosku w PDF na e-mail po złożeniu",
  "Bez zobowiązań — to wniosek o ofertę, nie umowa",
];

export default function StronaGlowna() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <span className="naglowek-sekcji">Salony beauty · kliniki estetyczne · gabinety</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
        Wniosek o ubezpieczenie majątkowe
      </h1>
      <p className="mt-3 max-w-2xl text-stone-600">
        Dla salonów kosmetycznych, klinik medycyny estetycznej i gabinetów beauty. Wypełnij wniosek
        online albo wczytaj arkusz, który masz już uzupełniony — dane przepiszą się automatycznie.
      </p>
      <ul className="mt-5 flex flex-col gap-2 text-sm text-stone-700 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {ATUTY.map((a) => (
          <li key={a} className="flex items-start gap-2">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-marka-500">
              <path fill="currentColor" d="M8.1 13.3 4.8 10l-1.3 1.3 4.6 4.6 8.4-8.4-1.3-1.3z" />
            </svg>
            {a}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="karta flex flex-col border-t-4 border-t-marka-500">
          <span className="naglowek-sekcji">Wypełnij online</span>
          <h2 className="mt-2 text-lg font-medium">Formularz krok po kroku</h2>
          <p className="mt-2 flex-1 text-sm text-stone-600">
            Osiem kroków, sumy liczone automatycznie, zapis w trakcie wypełniania. Do wniosku możesz
            wrócić później — dostaniesz link.
          </p>
          <PrzyciskNowyWniosek />
        </div>

        <div className="karta flex flex-col">
          <span className="naglowek-sekcji">Masz wypełniony arkusz</span>
          <h2 className="mt-2 text-lg font-medium">Wczytaj plik Excel</h2>
          <p className="mt-2 text-sm text-stone-600">
            Wgraj wypełniony szablon .xlsx. Pokażemy, co odczytaliśmy, zanim cokolwiek zostanie
            złożone.
          </p>
          <FormularzImportu />
          <a
            href="/szablon/wniosek-ubezpieczenie-majatkowe.xlsx"
            className="mt-4 text-sm text-marka-700 underline underline-offset-2 hover:text-marka-900"
            download
          >
            Pobierz pusty szablon .xlsx
          </a>
        </div>
      </div>

      <div className="karta mt-6">
        <span className="naglowek-sekcji">Wracasz do wniosku</span>
        <h2 className="mt-2 text-lg font-medium">Masz już rozpoczęty wniosek?</h2>
        <p className="mt-2 text-sm text-stone-600">
          Otwórz link, który dostałeś e-mailem, albo{" "}
          <a href="/moje" className="text-marka-700 underline underline-offset-2">
            zaloguj się kodem z maila
          </a>
          , żeby zobaczyć swoje wnioski.
        </p>
      </div>

      <SerwisyAura />
    </main>
  );
}
