import { redirect } from "next/navigation";
import { biezacyAgent } from "@/lib/autoryzacja";
import NawigacjaPanelu from "@/components/panel/NawigacjaPanelu";

export const dynamic = "force-dynamic";

/** Brama panelu: każda strona pod /admin wymaga sesji i aktywnego wpisu w mienie_agenci. */
export default async function LayoutPanelu({ children }: { children: React.ReactNode }) {
  const sesja = await biezacyAgent();
  if (!sesja) redirect("/login");
  const { agent } = sesja;

  return (
    <div>
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <NawigacjaPanelu admin={agent.rola === "admin"} />
          <span className="text-xs text-stone-500">
            {agent.imie_nazwisko || agent.email}
            <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-500">
              {agent.rola === "admin" ? "administrator" : "agent"}
            </span>
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
