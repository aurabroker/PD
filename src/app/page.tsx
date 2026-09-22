import FormularzImportu from "@/components/FormularzImportu";
import PrzyciskNowyWniosek from "@/components/PrzyciskNowyWniosek";

export default function StronaGlowna() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        Wniosek o ubezpieczenie majątkowe
      </h1>
      <p className="mt-3 max-w-2xl text-stone-600">
        Dla salonów kosmetycznych, klinik medycyny estetycznej i gabinetów beauty. Wypełnij wniosek
        online albo wczytaj arkusz, który masz już uzupełniony — dane przepiszą się automatycznie.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="karta flex flex-col">
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
    </main>
  );
}
