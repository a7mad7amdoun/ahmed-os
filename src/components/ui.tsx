import Link from "next/link";
import type { Score } from "@/lib/scoring";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}>
      {children}
    </section>
  );
}

export function CardHead({ title, ar, right, sub }: {
  title: string; ar?: string; right?: React.ReactNode; sub?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line-soft)] px-5 py-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[0.82rem] font-medium tracking-[0.08em] text-[var(--color-muted)] uppercase">
          {title}
        </h2>
        {ar && <span className="ar text-[0.95rem] text-[var(--color-faint)]">{ar}</span>}
      </div>
      {sub && <span className="text-xs text-[var(--color-faint)]">{sub}</span>}
      {right}
    </header>
  );
}

/** A score bar that always shows its own arithmetic: every category
 *  with its own percentage, its weight, and what it contributed. */
export function ScoreBlock({ score, label, ar, tone, suffix }: {
  score: Score; label: string; ar?: string; tone: "deen" | "growth"; suffix?: string;
}) {
  const pct = score.pct ?? 0;
  const color = tone === "deen" ? "var(--color-deen)" : "var(--color-gold)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[0.8rem] font-medium tracking-[0.07em] text-[var(--color-muted)] uppercase">{label}</h3>
          {ar && <span className="ar text-sm text-[var(--color-faint)]">{ar}</span>}
        </div>
        <div className="tnum text-[var(--color-text)]">
          <span className="text-2xl font-medium">{score.pct === null ? "—" : score.score}</span>
          <span className="text-sm text-[var(--color-faint)]"> / 20</span>
          {score.pct !== null && (
            <span className="ml-2 text-[0.78rem] text-[var(--color-faint)]">{Math.round(pct)}%</span>
          )}
        </div>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
        <div className="h-full rounded-full" style={{ width: `${Math.round(pct)}%`, background: color }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {score.contributions.map((c) => (
          <li key={c.key} className="flex items-baseline justify-between gap-2 text-[0.78rem]">
            <span className={c.counted ? "text-[var(--color-muted)]" : "text-[var(--color-faint)]"}>
              {c.label}{c.ar && <span className="ar ml-1.5 text-[var(--color-faint)]">{c.ar}</span>}
            </span>
            <span className="flex-1 border-b border-dotted border-[var(--color-line)]" />
            <span className="tnum text-[0.72rem] text-[var(--color-faint)]">w{c.weight}</span>
            <span className="tnum w-12 shrink-0 text-right text-[var(--color-muted)]">
              {c.pct === null ? (c.counted ? "0%" : "—") : `${Math.round(c.pct)}%`}
            </span>
          </li>
        ))}
      </ul>
      {suffix && <p className="mt-2 text-[0.72rem] text-[var(--color-faint)]">{suffix}</p>}
    </div>
  );
}

export function Stat({ value, label, tone = "text", ar }: {
  value: string; label: string; tone?: "text" | "deen" | "warn" | "faint"; ar?: string;
}) {
  const c = tone === "deen" ? "var(--color-deen)"
    : tone === "warn" ? "var(--color-warn)"
    : tone === "faint" ? "var(--color-faint)" : "var(--color-text)";
  return (
    <div>
      <div className="tnum text-xl font-medium" style={{ color: c }}>{value}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[0.72rem] tracking-wide text-[var(--color-faint)]">{label}</span>
        {ar && <span className="ar text-[0.72rem] text-[var(--color-faint)]">{ar}</span>}
      </div>
    </div>
  );
}

const NAV = [
  { href: "/", label: "Today" },
  { href: "/check-in", label: "Check-in" },
  { href: "/deen", label: "Deen", ar: "الدين" },
  { href: "/muhasabah", label: "Muhasabah", ar: "محاسبة" },
  { href: "/weekly", label: "Weekly" },
  { href: "/commitments", label: "Promises" },
  { href: "/finances", label: "Money" },
  { href: "/business", label: "Business" },
  { href: "/insights", label: "Patterns" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[0.8rem]">
      {NAV.map((n) => {
        const on = n.href === active;
        return (
          <Link key={n.href} href={n.href}
            className={`rounded px-2.5 py-1.5 transition-colors ${
              on ? "bg-[var(--color-raised)] text-[var(--color-text)]"
                 : "text-[var(--color-faint)] hover:text-[var(--color-muted)]"}`}>
            {n.label}
            {n.ar && <span className="ar ml-1.5 text-[var(--color-faint)]">{n.ar}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-6 sm:px-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line-soft)] pb-4">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-[0.95rem] font-medium tracking-[0.03em]">Ahmed OS</span>
          <span className="hidden text-[0.7rem] tracking-wide text-[var(--color-faint)] sm:inline">
            Deen first · Discipline always
          </span>
        </Link>
        <Nav active={active} />
      </div>
      <div className="fade-in">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-[0.82rem] leading-relaxed text-[var(--color-faint)]">{children}</p>;
}
