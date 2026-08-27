"use client";

import { useTransition } from "react";
import { toggleResetItem } from "@/app/actions";

type Group = {
  resetId: number;
  fromDate: string;
  items: { area: string; text: string; done: boolean; index: number; carried: boolean }[];
};

/** Pinned recovery actions. Plans lapse after 24 hours; a single
 *  unfinished Deen action carries over once and is labelled as such. */
export default function RecoveryPinned({ groups, className = "" }: {
  groups: Group[]; className?: string;
}) {
  const [pending, start] = useTransition();
  const items = groups.flatMap((g) => g.items.map((i) => ({ ...i, resetId: g.resetId })));
  if (!items.length) return null;
  const open = items.filter((i) => !i.done).length;

  return (
    <section className={`rounded-lg border border-[var(--color-deen-dim)] bg-[var(--color-surface)] ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-line-soft)] px-5 py-3">
        <h2 className="text-[0.8rem] font-medium tracking-[0.08em] uppercase text-[var(--color-deen)]">
          Recovery plan
        </h2>
        <span className="tnum text-[0.75rem] text-[var(--color-faint)]">
          {open === 0 ? "all done" : `${open} left`}
        </span>
      </header>
      <ul className={`divide-y divide-[var(--color-line-soft)] ${pending ? "opacity-70" : ""}`}>
        {items.map((p) => (
          <li key={`${p.resetId}-${p.index}`}>
            <button type="button"
              onClick={() => start(() => { toggleResetItem(p.resetId, p.index); })}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--color-raised)]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: p.done ? "var(--color-deen)" : "var(--color-line)",
                  background: p.done ? "var(--color-deen)" : "transparent",
                }}>
                {p.done && <span className="text-[0.6rem] text-[var(--color-ink)]">✓</span>}
              </span>
              <span className={`text-[0.86rem] ${p.done ? "text-[var(--color-faint)] line-through" : ""}`}>
                {p.text}
              </span>
              {p.carried && (
                <span className="ml-2 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.65rem] text-[var(--color-faint)]"
                  title="Carried from yesterday — this is its last day">
                  carried once
                </span>
              )}
              <span className="ml-auto text-[0.7rem] capitalize text-[var(--color-faint)]">{p.area}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
