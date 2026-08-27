"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";

const TONE: Record<string, string> = {
  income: "var(--color-deen)", debt_payment: "var(--color-deen)",
  saving: "var(--color-gold)", investment: "var(--color-gold)",
  expense: "var(--color-muted)",
};

export default function TxRow({ t }: { t: any }) {
  const [pending, start] = useTransition();
  const amount = Number(t.amount);
  const sign = t.type === "income" ? "+" : "−";

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[0.82rem] ${pending ? "opacity-50" : ""}`}>
      <span className="tnum w-20 shrink-0 text-[0.75rem] text-[var(--color-faint)]">{t.date}</span>
      <span className="capitalize" style={{ color: TONE[t.type] ?? "var(--color-text)" }}>
        {String(t.type).replace("_", " ")}
      </span>
      <span className="text-[0.75rem] text-[var(--color-faint)]">{t.category}</span>
      {t.isUnnecessary && (
        <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.65rem] text-[var(--color-warn)]">
          unnecessary
        </span>
      )}
      <span className="tnum ml-auto" style={{ color: TONE[t.type] ?? "var(--color-text)" }}>
        {sign}{new Intl.NumberFormat("en-GB").format(amount)}
      </span>
      <button type="button" onClick={() => start(() => { deleteTransaction(t.id); })}
        className="ml-2 text-[0.7rem] text-[var(--color-faint)] hover:text-[var(--color-alert)]"
        title="Delete">
        ×
      </button>
    </li>
  );
}
