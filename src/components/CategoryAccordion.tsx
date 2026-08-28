"use client";

import { useState } from "react";
import Link from "next/link";
import TierRow from "./TierRow";
import { StatusPill } from "./scores";
import { CATEGORY_DEFS, type CategoryKey, type CategoryScore } from "@/lib/categories";

/* Seven rows you can read in five seconds, each one door deep when you
   need it. Expanding happens in place — no navigation, so a prayer can
   be logged the moment it happens and Work at the end of the block,
   without ever leaving this screen. */

export default function CategoryAccordion({
  date, category, derivedKeys, openByDefault = false,
}: {
  date: string;
  category: CategoryScore;
  derivedKeys: string[];
  openByDefault?: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const def = CATEGORY_DEFS[category.key as CategoryKey];
  const derived = new Set(derivedKeys);

  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-[var(--color-raised)]">
        <span className="text-[1.05rem]" aria-hidden>{category.icon}</span>
        <span className="min-w-[8rem] text-[0.95rem]">
          {category.label}
          {category.ar && <span className="ar ml-2 text-[var(--color-faint)]">{category.ar}</span>}
        </span>

        <span className="tnum ml-auto text-[1.35rem] font-medium leading-none">
          {category.score}
          <span className="ml-0.5 text-[0.8rem] text-[var(--color-faint)]">/20</span>
        </span>

        <StatusPill status={category.status} />

        <span className="w-4 shrink-0 text-center text-[0.8rem] text-[var(--color-faint)]"
          aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      {/* A thin bar carries the score even when collapsed. */}
      <div className="h-[2px] w-full bg-[var(--color-line)]">
        <div className="h-full"
          style={{
            width: `${(category.score / 20) * 100}%`,
            background: category.score >= 13 ? "var(--color-deen)"
              : category.score >= 10 ? "var(--color-gold)" : "var(--color-warn)",
          }} />
      </div>

      {open && (
        <div className="fade-in">
          <p className="border-b border-[var(--color-line-soft)] px-5 py-2.5 text-[0.75rem] text-[var(--color-faint)]">
            {def.blurb}
            {" "}Weighted average of {category.loggedCount} of {category.totalCount} sub-habits
            {category.ceiling !== null && (
              category.capApplied !== null ? (
                <span className="text-[var(--color-warn)]">
                  {" "}· held to {category.capApplied} by the prayer ceiling
                </span>
              ) : (
                <span>{" "}· ceiling today is {category.ceiling}</span>
              )
            )}
          </p>

          {category.subs.map((s) => {
            const d = def.subs.find((x) => x.key === s.key)!;
            if (derived.has(s.key)) {
              return (
                <div key={s.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-line-soft)] px-5 py-3 last:border-b-0">
                  <span className="text-[0.86rem]">{s.label}</span>
                  <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.62rem] text-[var(--color-faint)]"
                    title="The app already knows this — no tap needed">
                    {d.input === "prayer" ? "from prayer log" : "from your entries"}
                  </span>
                  {s.detail && (
                    <span className="text-[0.75rem] text-[var(--color-faint)]">{s.detail}</span>
                  )}
                  <span className="tnum ml-auto text-[0.72rem] text-[var(--color-faint)]">
                    {s.points === null ? "not logged" : `${s.points}/20`}
                    <span className="ml-2 opacity-70">w{s.weight}</span>
                  </span>
                </div>
              );
            }
            return (
              <TierRow key={s.key} date={date} category={category.key as CategoryKey}
                subKey={s.key} label={s.label} prompt={d.prompt} weight={s.weight}
                selected={s.rawValue} points={s.points} />
            );
          })}

          {category.key === "deen" && (
            <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
              Prayers come from the prayer log below — tap them there as they happen.
              Qur'an, dhikr and Muhasabah raise this score toward the ceiling your completed
              prayers set, and can never push it past that.
            </p>
          )}
          {(category.key === "financial" || category.key === "work") && (
            <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] text-[var(--color-faint)]">
              Hours, pages and amounts are entered on{" "}
              <Link href={category.key === "work" ? "/check-in" : "/finances"}
                className="text-[var(--color-deen)] hover:underline">
                {category.key === "work" ? "the hours page" : "the money page"}
              </Link>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
