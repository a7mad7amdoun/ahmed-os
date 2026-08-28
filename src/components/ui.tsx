import Link from "next/link";

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

/* Navigation is grouped by cadence rather than listed flat: what you
   touch daily, the foundation, what you review weekly, and the
   longer-horizon areas. On a wide screen it is a persistent rail; on a
   phone it collapses to a scrolling strip. */
const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; ar?: string }[];
}[] = [
  {
    label: "Daily",
    items: [
      { href: "/", label: "Today" },
      { href: "/check-in", label: "Hours & pages" },
      { href: "/muhasabah", label: "Muhasabah", ar: "محاسبة" },
    ],
  },
  {
    label: "Review",
    items: [
      { href: "/weekly", label: "Friday review" },
      { href: "/reset", label: "Reset" },
    ],
  },
  {
    label: "Life",
    items: [
      { href: "/commitments", label: "Promises" },
      { href: "/finances", label: "Money" },
      { href: "/business", label: "Business" },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items).concat([{ href: "/settings", label: "Settings" }]);

function NavLink({ href, label, ar, active }: {
  href: string; label: string; ar?: string; active: boolean;
}) {
  return (
    <Link href={href}
      className={`relative block rounded-md px-3 py-[7px] text-[0.83rem] transition-colors ${
        active
          ? "bg-[var(--color-raised)] text-[var(--color-text)]"
          : "text-[var(--color-faint)] hover:bg-[var(--color-raised)]/50 hover:text-[var(--color-muted)]"}`}>
      {active && (
        <span className="absolute left-0 top-1/2 h-[14px] w-[2px] -translate-y-1/2 rounded-full bg-[var(--color-deen)]" />
      )}
      {label}
      {ar && <span className="ar ml-1.5 text-[var(--color-faint)]">{ar}</span>}
    </Link>
  );
}

export function Nav({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 text-[0.8rem] lg:hidden">
      {ALL_NAV.map((n) => (
        <Link key={n.href} href={n.href}
          className={`shrink-0 rounded-md px-2.5 py-1.5 transition-colors ${
            n.href === active
              ? "bg-[var(--color-raised)] text-[var(--color-text)]"
              : "text-[var(--color-faint)] hover:text-[var(--color-muted)]"}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function Shell({ active, children, wide }: {
  active: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Persistent rail on wide screens. */}
      <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col border-r border-[var(--color-line-soft)] bg-[var(--color-ink)]/40 px-3 py-6 lg:flex">
        <Link href="/" className="mb-7 block px-3">
          <span className="block text-[0.95rem] font-medium tracking-[0.02em]">Ahmed OS</span>
          <span className="mt-0.5 block text-[0.68rem] leading-tight text-[var(--color-faint)]">
            Deen first<br />Discipline always
          </span>
        </Link>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[0.63rem] font-medium uppercase tracking-[0.14em] text-[var(--color-faint)]">
                {g.label}
              </p>
              <div className="space-y-[2px]">
                {g.items.map((n) => (
                  <NavLink key={n.href} {...n} active={n.href === active} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-[var(--color-line-soft)] pt-3">
          <NavLink href="/settings" label="Settings" active={active === "/settings"} />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {/* Mobile header. */}
        <div className="border-b border-[var(--color-line-soft)] px-5 pt-5 lg:hidden">
          <Link href="/" className="text-[0.95rem] font-medium">Ahmed OS</Link>
          <div className="mt-3"><Nav active={active} /></div>
        </div>

        <div className={`mx-auto w-full px-5 pb-24 pt-6 sm:px-8 lg:pt-9 ${
          wide ? "max-w-[1680px]" : "max-w-[1280px]"}`}>
          <div className="fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-[0.82rem] leading-relaxed text-[var(--color-faint)]">{children}</p>;
}
