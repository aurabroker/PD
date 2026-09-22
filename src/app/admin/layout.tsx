import { redirect } from "next/navigation";
import { biezacyAdmin } from "@/lib/autoryzacja";

export const dynamic = "force-dynamic";

/** Brama panelu: kazda strona pod /admin wymaga sesji i wpisu w katalog_admins. */
export default async function LayoutPanelu({ children }: { children: React.ReactNode }) {
  const admin = await biezacyAdmin();
  if (!admin) redirect("/login");

  return (
    <div>
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 text-sm">
          <nav className="flex gap-4">
            <a href="/admin" className="font-medium text-stone-700 hover:text-marka-700">
              Wnioski
            </a>
          </nav>
          <span className="text-stone-500">{admin.email}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
