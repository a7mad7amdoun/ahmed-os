"use client";

import { useTransition } from "react";
import { togglePractice } from "@/app/actions";
import { Group } from "@/components/Check";

export default function PracticeToggles({ date, defs, rows }: {
  date: string;
  defs: { key: string; label: string; labelAr: string | null }[];
  rows: { key: string; done: boolean }[];
}) {
  const [pending, start] = useTransition();
  return (
    <Group title="Voluntary practices" ar="النوافل"
      note="Optional. Tracked apart from the obligatory prayers so a gap here can never disguise a gap there.">
      <div className={`flex flex-wrap gap-2 ${pending ? "opacity-70" : ""}`}>
        {defs.map((d) => {
          const on = rows.find((r) => r.key === d.key)?.done ?? false;
          return (
            <button key={d.key} type="button"
              onClick={() => start(() => { togglePractice(date, d.key); })}
              className={`rounded border px-3 py-1.5 text-[0.78rem] transition-colors ${
                on ? "border-[var(--color-deen-dim)] bg-[var(--color-deen-dim)]/25 text-[var(--color-deen)]"
                   : "border-[var(--color-line)] text-[var(--color-faint)] hover:border-[var(--color-deen-dim)]"}`}>
              {d.label}{d.labelAr && <span className="ar ml-1.5">{d.labelAr}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[0.7rem] text-[var(--color-faint)]">Saved as you tap.</p>
    </Group>
  );
}
