"use client";

import { useTransition } from "react";
import { logTier } from "@/app/actions";
import { TIERS } from "@/lib/tiers";
import type { CategoryKey } from "@/lib/categories";

/* The one interaction the whole app is built on. Six labels, one tap.
   The wording above changes per habit; these never do — which is what
   makes a detailed system stay quick to use every day. */

const TIER_TONE: Record<string, string> = {
  missed:    "var(--color-faint)",
  poor:      "var(--color-warn)",
  partial:   "var(--color-warn)",
  adequate:  "var(--color-gold)",
  good:      "var(--color-deen)",
  excellent: "var(--color-deen)",
};

export default function TierRow({
  date, category, subKey, label, prompt, weight, selected, points,
}: {
  date: string;
  category: CategoryKey;
  subKey: string;
  label: string;
  prompt?: string;
  weight: number;
  selected: string | null;
  points: number | null;
}) {
  const [pending, start] = useTransition();

  const tap = (tier: string) =>
    // Tapping the current tier clears it, so a mis-tap is recoverable.
    start(() => { logTier(date, category, subKey, selected === tier ? null : tier); });

  return (
    <div className={`border-b border-[var(--color-line-soft)] px-5 py-3.5 last:border-b-0 ${
      pending ? "opacity-60" : ""}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-[0.86rem]">{label}</span>
          {prompt && (
            <span className="ml-2 text-[0.75rem] text-[var(--color-faint)]">{prompt}</span>
          )}
        </div>
        <span className="tnum shrink-0 text-[0.72rem] text-[var(--color-faint)]">
          {points === null ? "not logged" : `${points}/20`}
          <span className="ml-2 opacity-70">w{weight}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIERS.map((t) => {
          const on = selected === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => tap(t.key)}
              aria-pressed={on}
              title={`${t.meaning} · ${t.points}/20`}
              className={`rounded px-2.5 py-1.5 text-[0.75rem] transition-colors ${
                on
                  ? "text-[var(--color-ink)]"
                  : "border border-[var(--color-line)] text-[var(--color-faint)] hover:border-[var(--color-deen-dim)] hover:text-[var(--color-muted)]"
              }`}
              style={on ? { background: TIER_TONE[t.key], borderColor: TIER_TONE[t.key] } : undefined}>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
