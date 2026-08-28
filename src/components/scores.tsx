import Link from "next/link";
import type { CategoryScore, StatusKey } from "@/lib/categories";
import { STATUS_LABELS } from "@/lib/categories";
import type { MajorScore } from "@/lib/scoring";

/* Status is shown as a band on a single-hue ramp, never as a traffic
   light. There is deliberately no alarm red anywhere: a weak score is
   information, and colouring it like a fire alarm is what makes people
   stop opening the app. */
const STATUS_TONE: Record<StatusKey, string> = {
  critical:       "var(--color-faint)",
  below_standard: "var(--color-warn)",
  pass:           "var(--color-gold)",
  good:           "var(--color-deen)",
  strong:         "var(--color-deen)",
  exceptional:    "var(--color-deen)",
};

export function StatusPill({ status, className = "" }: { status: StatusKey; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-[3px] text-[0.68rem] tracking-[0.04em] ${className}`}
      style={{ color: STATUS_TONE[status], borderColor: "var(--color-line)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_TONE[status] }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** A 0–20 score with its bar. Big and legible — this is a numbers-first
 *  product and the score is meant to be the largest thing on screen. */
export function ScoreFigure({ score, size = "lg" }: { score: number; size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <span className="tnum inline-flex items-baseline">
      <span className={big ? "text-[2.6rem] font-medium leading-none" : "text-[1.35rem] font-medium leading-none"}>
        {score}
      </span>
      <span className={`text-[var(--color-faint)] ${big ? "ml-1 text-[0.95rem]" : "ml-0.5 text-[0.75rem]"}`}>
        /20
      </span>
    </span>
  );
}

function Bar({ score, tone }: { score: number; tone: string }) {
  return (
    <span className="block h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
      <span className="block h-full rounded-full"
        style={{ width: `${(score / 20) * 100}%`, background: tone }} />
    </span>
  );
}

/** One of the three headline scores, with its member categories. */
export function MajorCard({ major, href }: { major: MajorScore; href?: string }) {
  const tone = STATUS_TONE[major.status];
  const body = (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:border-[var(--color-deen-dim)]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.72rem] font-medium uppercase tracking-[0.13em] text-[var(--color-muted)]">
          {major.label}
          {major.ar && <span className="ar ml-2 normal-case tracking-normal text-[var(--color-faint)]">{major.ar}</span>}
        </h3>
        <StatusPill status={major.status} />
      </div>

      <div className="mt-3"><ScoreFigure score={major.score} /></div>
      <div className="mt-3"><Bar score={major.score} tone={tone} /></div>

      <ul className="mt-3.5 space-y-1.5">
        {major.members.map((m) => (
          <li key={m.key} className="flex items-baseline gap-2 text-[0.76rem]">
            <span className="text-[var(--color-faint)]">{m.label}</span>
            <span className="flex-1 border-b border-dotted border-[var(--color-line)]" />
            <span className="tnum text-[var(--color-muted)]">{m.score}</span>
            {m.capApplied !== null && (
              <span className="text-[0.65rem] text-[var(--color-warn)]" title={`Held to ${m.capApplied} by its ceiling`}>
                capped
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/* ── "Why did my score change?" ───────────────────────────────── */

const STATE_MARK: Record<string, { mark: string; tone: string }> = {
  met:     { mark: "✓", tone: "var(--color-deen)" },
  partial: { mark: "◐", tone: "var(--color-gold)" },
  missed:  { mark: "○", tone: "var(--color-faint)" },
  pending: { mark: "·", tone: "var(--color-line)" },
};

export function CategoryBreakdown({ c }: { c: CategoryScore }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line-soft)] px-5 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-[0.9rem] font-medium">
            {c.label}
            {c.ar && <span className="ar ml-2 text-[var(--color-faint)]">{c.ar}</span>}
          </h3>
          <StatusPill status={c.status} />
        </div>
        <ScoreFigure score={c.score} size="sm" />
      </header>

      <ul className="divide-y divide-[var(--color-line-soft)]">
        {c.subs.map((b) => (
          <li key={b.key} className="flex items-center gap-3 px-5 py-2.5 text-[0.82rem]">
            <span className="w-3 shrink-0 text-center"
              style={{ color: b.points === null ? "var(--color-line)"
                : b.points >= 17 ? "var(--color-deen)"
                : b.points >= 10 ? "var(--color-gold)" : "var(--color-faint)" }}>
              {b.points === null ? "·" : b.points >= 14 ? "✓" : b.points > 0 ? "◐" : "○"}
            </span>
            <span className={b.points === null ? "text-[var(--color-faint)]" : ""}>{b.label}</span>
            {b.detail && (
              <span className="text-[0.72rem] text-[var(--color-faint)]">— {b.detail}</span>
            )}
            <span className="tnum ml-auto shrink-0 text-[0.75rem] text-[var(--color-faint)]">
              {b.points === null ? "—" : `${b.points}/20`}
              <span className="ml-1.5 text-[0.68rem]">w{b.weight}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
        Weighted average of {c.loggedCount} of {c.totalCount} sub-habits → {c.weightedScore}/20
        {c.capApplied !== null ? (
          <>
            <span className="text-[var(--color-warn)]">
              {" "}· held to {c.capApplied} by the ceiling
            </span>
            {c.key === "deen" && " that your completed prayers set."}
            {c.key === "growth" && " because the learning was not applied."}
          </>
        ) : " · no ceiling applied"}
      </p>
    </div>
  );
}

/** A compact category row for lists. */
export function CategoryRow({ c }: { c: CategoryScore }) {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className="w-24 shrink-0 text-[0.8rem] text-[var(--color-muted)]">{c.label}</span>
      <span className="flex-1"><Bar score={c.score} tone={STATUS_TONE[c.status]} /></span>
      <span className="tnum w-12 shrink-0 text-right text-[0.78rem] text-[var(--color-muted)]">
        {c.score}<span className="text-[var(--color-faint)]">/20</span>
      </span>
    </li>
  );
}
