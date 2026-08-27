import { requirePage } from "@/lib/page-auth";
import { loadSettings } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { todayIn, addDays } from "@/lib/dates";
import { addTransaction, saveDebt, addSavingsGoal } from "@/app/actions";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";
import { Check, Field } from "@/components/Check";
import TxRow from "./TxRow";
import { MoneyStack } from "@/components/charts";

export const dynamic = "force-dynamic";

const mad = (n: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n) + " MAD";

const TYPES = [
  { v: "income", l: "Income" }, { v: "expense", l: "Expense" },
  { v: "debt_payment", l: "Debt payment" }, { v: "saving", l: "Saving" },
  { v: "investment", l: "Investment" },
];
const CATS = ["salary", "freelance", "business", "essential", "personal", "transport",
  "family", "tools", "other"];

export default async function Finances() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const monthStart = today.slice(0, 8) + "01";
  const db = await getDb();

  // Six months back, for the monthly buckets.
  const sixStart = (() => {
    const [y, m] = monthStart.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 6, 1));
    return d.toISOString().slice(0, 10);
  })();

  const [debts, savings, monthTx, recentTx, allPayments, sixMonthTx] = await Promise.all([
    db.select().from(schema.debts)
      .where(and(eq(schema.debts.userId, userId), eq(schema.debts.status, "open"))),
    db.select().from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.userId, userId), eq(schema.savingsGoals.status, "open"))),
    db.select().from(schema.financialTransactions).where(and(
      eq(schema.financialTransactions.userId, userId),
      gte(schema.financialTransactions.date, monthStart),
      lte(schema.financialTransactions.date, today))),
    db.select().from(schema.financialTransactions)
      .where(eq(schema.financialTransactions.userId, userId))
      .orderBy(desc(schema.financialTransactions.date), desc(schema.financialTransactions.id)).limit(25),
    db.select().from(schema.financialTransactions).where(and(
      eq(schema.financialTransactions.userId, userId),
      eq(schema.financialTransactions.type, "debt_payment"))),
    db.select().from(schema.financialTransactions).where(and(
      eq(schema.financialTransactions.userId, userId),
      gte(schema.financialTransactions.date, sixStart),
      lte(schema.financialTransactions.date, today))),
  ]);

  /* Where each month's income went. Stacking is legitimate here
     because expenses, repayments, savings and what is left are
     genuine parts of one whole — income. Stacking income beside
     expenses would not be. */
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const [y, m] = monthStart.split("-").map(Number);
    return new Date(Date.UTC(y, m - 6 + i, 1)).toISOString().slice(0, 7);
  });
  const stackData = monthKeys.map((key) => {
    const rows = (sixMonthTx as any[]).filter((t) => String(t.date).startsWith(key));
    const by = (type: string) => rows.filter((t) => t.type === type)
      .reduce((a, t) => a + Number(t.amount), 0);
    const inc = by("income"), exp = by("expense");
    const dbt = by("debt_payment"), sav = by("saving") + by("investment");
    return {
      month: key.slice(5) + "/" + key.slice(2, 4),
      expenses: exp, debt: dbt, savings: sav,
      left: Math.max(0, inc - exp - dbt - sav),
    };
  });
  const hasMoneyHistory = stackData.some((m) =>
    m.expenses + m.debt + m.savings + m.left > 0);

  const sum = (rows: any[], type?: string) => rows
    .filter((t) => !type || t.type === type)
    .reduce((a, t) => a + Number(t.amount), 0);

  const income = sum(monthTx as any[], "income");
  const expense = sum(monthTx as any[], "expense");
  const repaidMonth = sum(monthTx as any[], "debt_payment");
  const savedMonth = sum(monthTx as any[], "saving");
  const wasted = (monthTx as any[]).filter((t) => t.isUnnecessary)
    .reduce((a, t) => a + Number(t.amount), 0);
  const net = income - expense - repaidMonth - savedMonth;

  const totalDebt = (debts as any[]).reduce((a, d) => a + Number(d.totalAmount), 0);
  const totalRepaid = sum(allPayments as any[]);
  const remaining = Math.max(0, totalDebt - totalRepaid);
  const progress = totalDebt > 0 ? Math.min(100, (totalRepaid / totalDebt) * 100) : 0;
  const savedTotal = sum(
    (recentTx as any[]).length ? await db.select().from(schema.financialTransactions).where(and(
      eq(schema.financialTransactions.userId, userId),
      eq(schema.financialTransactions.type, "saving"))) : [] as any[]);

  return (
    <Shell active="/finances">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Financial recovery</h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          Stabilise → reduce debt → save → invest → grow, in that order. This page tracks where you
          actually are, not where you hope to be.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="Debt" sub={totalDebt > 0 ? `${Math.round(progress)}% repaid` : undefined} />
        {(debts as any[]).length === 0 ? (
          <div className="px-5 py-4">
            <p className="mb-4 text-[0.82rem] text-[var(--color-faint)]">
              No debt recorded yet. Add it — a number you can see is easier to reduce than one you avoid.
            </p>
            <DebtForm />
          </div>
        ) : (
          <>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="tnum text-[1.5rem] font-medium">{mad(remaining)}</span>
                <span className="text-[0.78rem] text-[var(--color-faint)]">
                  remaining of {mad(totalDebt)}
                </span>
              </div>
              <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                <div className="h-full rounded-full bg-[var(--color-deen)]"
                  style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                <Stat value={mad(totalRepaid)} label="Repaid so far"
                  tone={totalRepaid > 0 ? "deen" : "faint"} />
                <Stat value={mad(repaidMonth)} label="Repaid this month"
                  tone={repaidMonth > 0 ? "deen" : "faint"} />
                {(debts as any[])[0]?.monthlyTarget && (
                  <Stat value={mad(Number((debts as any[])[0].monthlyTarget))} label="Monthly target" tone="faint" />
                )}
              </div>
            </div>
            <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
              {totalRepaid === 0
                ? "Nothing repaid yet. The first payment matters more than its size — it turns the number from fixed into moving."
                : `Every payment logged here counts toward this bar. No projected payoff date is shown, because one built on ${(allPayments as any[]).length} payment${(allPayments as any[]).length === 1 ? "" : "s"} would be a guess dressed as a plan.`}
            </p>
          </>
        )}
      </Card>

      <Card className="mb-5">
        <CardHead title="This month" sub={monthStart.slice(0, 7)} />
        <div className="flex flex-wrap gap-x-10 gap-y-4 px-5 py-4">
          <Stat value={mad(income)} label="Income" tone={income > 0 ? "deen" : "faint"} />
          <Stat value={mad(expense)} label="Expenses" />
          <Stat value={mad(repaidMonth)} label="Debt repaid" tone={repaidMonth > 0 ? "deen" : "faint"} />
          <Stat value={mad(savedMonth)} label="Saved" tone={savedMonth > 0 ? "deen" : "faint"} />
          <Stat value={mad(wasted)} label="Unnecessary" tone={wasted > 0 ? "warn" : "faint"} />
          <Stat value={mad(net)} label="Left over" tone={net >= 0 ? "text" : "warn"} />
        </div>
        {income === 0 && expense === 0 && (
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] text-[var(--color-faint)]">
            Nothing logged this month yet.
          </p>
        )}
      </Card>

      {hasMoneyHistory && (
        <Card className="mb-5">
          <CardHead title="Where the money went" sub="Last six months" />
          <div className="px-3 py-4"><MoneyStack data={stackData} /></div>
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
            Each bar is one month's income split into where it went. Income is the total, not a
            separate bar — stacking income beside expenses would not be a part-to-whole.
          </p>
        </Card>
      )}

      <Card className="mb-5">
        <CardHead title="Log a transaction" />
        <form action={addTransaction} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_form" value="transaction" />
          <Field label="Type">
            <select name="type" defaultValue="expense">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select name="category" defaultValue="essential">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Amount (MAD)">
            <input name="amount" type="number" step="1" min="0" inputMode="decimal" required />
          </Field>
          <Field label="Date"><input name="date" type="date" defaultValue={today} /></Field>
          <button type="submit"
            className="h-[38px] rounded bg-[var(--color-deen-dim)] px-4 text-[0.82rem] transition-colors hover:bg-[var(--color-deen)]/40">
            Log
          </button>
          <div className="sm:col-span-5">
            <Check name="isUnnecessary" label="This was unnecessary"
              hint="Marking it honestly is what makes the monthly number mean anything." />
          </div>
        </form>
      </Card>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHead title="Savings" />
          {(savings as any[]).length === 0 ? (
            <div className="px-5 py-4">
              <p className="mb-3 text-[0.8rem] leading-relaxed text-[var(--color-faint)]">
                Savings come after debt in the order above. Add a goal when you are ready for it —
                there is no pressure to have one yet.
              </p>
              <form action={addSavingsGoal} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_form" value="savings" />
                <Field label="Name"><input name="name" placeholder="Emergency buffer" /></Field>
                <Field label="Target"><input name="targetAmount" type="number" min="0" required /></Field>
                <button type="submit"
                  className="h-[38px] rounded border border-[var(--color-line)] px-3 text-[0.8rem] text-[var(--color-muted)]">
                  Add
                </button>
              </form>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-line-soft)]">
              {(savings as any[]).map((g) => {
                const pct = Math.min(100, (savedTotal / Number(g.targetAmount)) * 100);
                return (
                  <li key={g.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between text-[0.84rem]">
                      <span>{g.name}</span>
                      <span className="tnum text-[var(--color-faint)]">
                        {mad(savedTotal)} / {mad(Number(g.targetAmount))}
                      </span>
                    </div>
                    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--color-line)]">
                      <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Debt detail" />
          <div className="px-5 py-4"><DebtForm debt={(debts as any[])[0]} marker="debtDetail" /></div>
        </Card>
      </div>

      <Card>
        <CardHead title="Recent transactions" />
        {(recentTx as any[]).length === 0 ? <Empty>Nothing logged yet.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {(recentTx as any[]).map((t) => <TxRow key={t.id} t={t} />)}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function DebtForm({ debt, marker = "debt" }: { debt?: any; marker?: string }) {
  return (
    <form action={saveDebt} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="_form" value={marker} />
      {debt && <input type="hidden" name="id" value={debt.id} />}
      <Field label="Name">
        <input name="name" defaultValue={debt?.name ?? ""} placeholder="Total debt" required />
      </Field>
      <Field label="Total (MAD)">
        <input name="totalAmount" type="number" min="0" step="1"
          defaultValue={debt ? Number(debt.totalAmount) : 30000} required />
      </Field>
      <Field label="Monthly target">
        <input name="monthlyTarget" type="number" min="0" step="1"
          defaultValue={debt?.monthlyTarget ? Number(debt.monthlyTarget) : ""} />
      </Field>
      <button type="submit"
        className="h-[38px] rounded border border-[var(--color-line)] px-3 text-[0.8rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-deen-dim)]">
        {debt ? "Update" : "Add"}
      </button>
    </form>
  );
}
