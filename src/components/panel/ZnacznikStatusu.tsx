import { STATUS_ETYKIETY, STATUS_KOLORY, type Status } from "@/lib/slowniki";

export default function ZnacznikStatusu({ status }: { status: string }) {
  const s = status as Status;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_KOLORY[s] ?? "bg-stone-100"}`}>
      {STATUS_ETYKIETY[s] ?? status}
    </span>
  );
}
