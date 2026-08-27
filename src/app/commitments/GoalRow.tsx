"use client";

import { useTransition } from "react";
import { setGoalStatus } from "@/app/actions";

export default function GoalRow({ g }: { g: any }) {
  const [pending, start] = useTransition();
  const set = (s: "open" | "achieved" | "abandoned") => start(() => { setGoalStatus(g.id, s); });

  const color = g.status === "achieved" ? "var(--color-deen)"
    : g.status === "abandoned" ? "var(--color-faint)" : "var(--color-line)";

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 ${pending ? "opacity-70" : ""}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className={`text-[0.86rem] ${g.status !== "open" ? "text-[var(--color-faint)]" : ""}`}>
        {g.title}
      </span>
      <span className="text-[0.72rem] capitalize text-[var(--color-faint)]">{g.category}</span>
      {g.targetDate && <span className="tnum text-[0.72rem] text-[var(--color-faint)]">by {g.targetDate}</span>}
      <div className="ml-auto flex gap-1.5">
        {g.status === "open" ? (
          <>
            <button type="button" onClick={() => set("achieved")}
              className="rounded border border-[var(--color-deen-dim)] px-2.5 py-1 text-[0.73rem] text-[var(--color-deen)]">
              Achieved
            </button>
            <button type="button" onClick={() => set("abandoned")}
              className="rounded border border-[var(--color-line)] px-2.5 py-1 text-[0.73rem] text-[var(--color-faint)]">
              Let go
            </button>
          </>
        ) : (
          <button type="button" onClick={() => set("open")}
            className="rounded border border-[var(--color-line)] px-2.5 py-1 text-[0.73rem] text-[var(--color-faint)]">
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}
