import FormularzHasla from "./FormularzHasla";

export const dynamic = "force-dynamic";

export default async function UstawHaslo({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="karta">
        <h1 className="text-xl font-semibold">Ustaw hasło do panelu</h1>
        <p className="mt-2 text-sm text-stone-600">
          Hasło musi mieć co najmniej 10 znaków. Po zapisaniu od razu przejdziesz do panelu wniosków.
        </p>
        {token_hash && type ? (
          <FormularzHasla tokenHash={token_hash} typ={type} />
        ) : (
          <p className="komunikat-bledu mt-4">
            Link jest niepełny. Otwórz go ponownie z wiadomości e-mail albo poproś administratora o nowy.
          </p>
        )}
      </div>
    </main>
  );
}
