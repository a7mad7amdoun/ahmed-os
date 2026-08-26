"use client";

/** Tri-state checkbox. The hidden "no" sits before the box so an
 *  unchecked answer submits as an explicit no, while a field never
 *  rendered stays null. Unanswered ≠ answered "no". */
export function Check({ name, label, ar, defaultChecked, hint }: {
  name: string; label: string; ar?: string; defaultChecked?: boolean | null; hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded border border-[var(--color-line)] px-3 py-2.5 transition-colors hover:border-[var(--color-deen-dim)] has-[:checked]:border-[var(--color-deen-dim)] has-[:checked]:bg-[var(--color-deen-dim)]/15">
      <input type="hidden" name={name} value="no" />
      <input type="checkbox" name={name} value="yes" defaultChecked={defaultChecked ?? false}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-deen)]" style={{ width: "0.9rem" }} />
      <span className="min-w-0">
        <span className="block text-[0.82rem] leading-tight text-[var(--color-text)]">
          {label}{ar && <span className="ar ml-1.5 text-[var(--color-faint)]">{ar}</span>}
        </span>
        {hint && <span className="mt-0.5 block text-[0.7rem] leading-snug text-[var(--color-faint)]">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, ar, hint, children }: {
  label: string; ar?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        {label}{ar && <span className="ar ml-1.5">{ar}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[0.7rem] leading-snug text-[var(--color-faint)]">{hint}</p>}
    </div>
  );
}

export function Group({ title, ar, note, children }: {
  title: string; ar?: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <header className="border-b border-[var(--color-line-soft)] px-5 py-3">
        <h2 className="text-[0.8rem] font-medium tracking-[0.08em] uppercase text-[var(--color-muted)]">
          {title}{ar && <span className="ar ml-2 normal-case tracking-normal text-[var(--color-faint)]">{ar}</span>}
        </h2>
        {note && <p className="mt-1 text-[0.72rem] text-[var(--color-faint)]">{note}</p>}
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}
