"use client";

import { useTransition } from "react";
import { setCommitmentStatus } from "@/app/actions";

const TONE: Record<string, string> = {
  kept: "var(--color-deen)", broken: "var(--color-alert)",
  dropped: "var(--color-faint)", open: "var(--color-line)",
};

export default function CommitmentRow({ c, overdue }: { c: any; overdue?: boolean }) {
  const [pending, start] = useTransition();
  const set = (s: "kept" | "broken" | "open" | "dropped") =>
    start(() => { setCommitmentStatus(c.id, s); });

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 ${pending ? "opacity-70" : ""}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE[c.status] }} />
      <span className={`text-[0.86rem] ${c.status === "kept" ? "text-[var(--color-faint)]" : ""}`}>
        {c.text}
      </span>
      <span className="text-[0.72rem] capitalize text-[var(--color-faint)]">{c.area}</span>
      {c.dueOn && (
        <span className="tnum text-[0.72rem]"
          style={{ color: overdue ? "var(--color-warn)" : "var(--color-faint)" }}>
          due {c.dueOn}
        </span>
      )}
      <div className="ml-auto flex flex-wrap gap-1.5">
        {c.status === "open" ? (
          <>
            <B onClick={() => set("kept")} tone="deen">Kept</B>
            <B onClick={() => set("broken")}>Broken</B>
            <B onClick={() => set("dropped")}>Dropped</B>
          </>
        ) : (
          <>
            <span className="rounded px-2 py-1 text-[0.72rem] capitalize" style={{ color: TONE[c.status] }}>
              {c.status}
            </span>
            <B onClick={() => set("open")}>Reopen</B>
          </>
        )}
      </div>
    </li>
  );
}

function B({ children, onClick, tone }: {
  children: React.ReactNode; onClick: () => void; tone?: "deen";
}) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[0.73rem] transition-colors ${
        tone === "deen"
          ? "border-[var(--color-deen-dim)] text-[var(--color-deen)] hover:bg-[var(--color-deen-dim)]/30"
          : "border-[var(--color-line)] text-[var(--color-faint)] hover:text-[var(--color-muted)]"}`}>
      {children}
    </button>
  );
}
