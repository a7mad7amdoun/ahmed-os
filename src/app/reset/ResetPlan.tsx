"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleResetItem } from "@/app/actions";

type P = { area: string; text: string; done: boolean };

export default function ResetPlan({ reset }: {
  reset: {
    id: number; plan: P[]; whatHappened: string | null; realCause: string | null;
    smallestAction: string | null; completedAt: string | null;
  };
}) {
  const [pending, start] = useTransition();
  const done = reset.plan.filter((p) => p.done).length;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line-soft)] px-5 py-3">
          <h2 className="text-[0.8rem] font-medium tracking-[0.08em] uppercase text-[var(--color-muted)]">
            Today's recovery plan
          </h2>
          <span className="tnum text-[0.75rem] text-[var(--color-faint)]">
            {done}/{reset.plan.length} done
          </span>
        </header>

        <ul className={`divide-y divide-[var(--color-line-soft)] ${pending ? "opacity-70" : ""}`}>
          {reset.plan.map((p, i) => (
            <li key={i}>
              <button type="button"
                onClick={() => start(() => { toggleResetItem(reset.id, i); })}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-raised)]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: p.done ? "var(--color-deen)" : "var(--color-line)",
                    background: p.done ? "var(--color-deen)" : "transparent",
                  }}>
                  {p.done && <span className="text-[0.6rem] text-[var(--color-ink)]">✓</span>}
                </span>
                <span className={`text-[0.88rem] ${p.done ? "text-[var(--color-faint)] line-through" : ""}`}>
                  {p.text}
                </span>
                <span className="ml-auto text-[0.7rem] capitalize text-[var(--color-faint)]">{p.area}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="border-t border-[var(--color-line-soft)] px-5 py-3 text-[0.78rem] leading-relaxed text-[var(--color-faint)]">
          {reset.completedAt
            ? "All four done. That is what recovery looks like — small, same-day, unremarkable."
            : "One at a time. Finishing even one of these today is the difference between a bad day and a bad month."}
        </p>
      </section>

      <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
        <h3 className="text-[0.72rem] tracking-[0.1em] uppercase text-[var(--color-faint)]">What you wrote</h3>
        <dl className="mt-3 space-y-2.5 text-[0.82rem]">
          {reset.whatHappened && (
            <div><dt className="text-[0.72rem] text-[var(--color-faint)]">What happened</dt>
              <dd className="mt-0.5 leading-relaxed">{reset.whatHappened}</dd></div>
          )}
          {reset.realCause && (
            <div><dt className="text-[0.72rem] text-[var(--color-faint)]">Real cause</dt>
              <dd className="mt-0.5">{reset.realCause}</dd></div>
          )}
          {reset.smallestAction && (
            <div><dt className="text-[0.72rem] text-[var(--color-faint)]">Smallest action back</dt>
              <dd className="mt-0.5">{reset.smallestAction}</dd></div>
          )}
        </dl>
      </section>

      <Link href="/" className="inline-block text-[0.8rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
        ← Back to dashboard
      </Link>
    </div>
  );
}
