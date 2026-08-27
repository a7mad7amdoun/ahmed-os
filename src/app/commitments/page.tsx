import { requirePage } from "@/lib/page-auth";
import { loadSettings } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, desc, asc } from "drizzle-orm";
import { todayIn, addDays, fmtLongDate } from "@/lib/dates";
import { addCommitment, addGoal } from "@/app/actions";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";
import { Field } from "@/components/Check";
import CommitmentRow from "./CommitmentRow";
import GoalRow from "./GoalRow";

export const dynamic = "force-dynamic";

const AREAS = ["deen", "work", "family", "health", "financial", "growth", "business"];

export default async function Commitments() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const db = await getDb();

  const [commitments, goals] = await Promise.all([
    db.select().from(schema.commitments).where(eq(schema.commitments.userId, userId))
      .orderBy(desc(schema.commitments.madeOn)).limit(100),
    db.select().from(schema.goals).where(eq(schema.goals.userId, userId))
      .orderBy(asc(schema.goals.status), desc(schema.goals.createdAt)).limit(50),
  ]);

  const all = commitments as any[];
  const open = all.filter((c) => c.status === "open");
  const overdue = open.filter((c) => c.dueOn && c.dueOn < today);
  const dueToday = open.filter((c) => c.dueOn === today);
  const upcoming = open.filter((c) => !c.dueOn || c.dueOn > today);
  const closed = all.filter((c) => c.status !== "open").slice(0, 20);

  const last30 = all.filter((c) => c.status !== "open" && c.closedOn && c.closedOn >= addDays(today, -30));
  const kept30 = last30.filter((c) => c.status === "kept").length;
  const rate = last30.length ? Math.round((kept30 / last30.length) * 100) : null;

  return (
    <Shell active="/commitments">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Promises & goals</h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          A promise nobody checks is not a promise. Everything here feeds Friday's review and the
          Discipline score — kept over due, measured rather than remembered.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="Promise record" sub="Last 30 days, closed commitments only" />
        <div className="flex flex-wrap gap-x-10 gap-y-4 px-5 py-4">
          <Stat value={rate === null ? "—" : `${rate}%`} label="Kept"
            tone={rate === null ? "faint" : rate >= 70 ? "deen" : rate >= 40 ? "warn" : "faint"} />
          <Stat value={`${kept30}/${last30.length}`} label="Kept / closed" tone="faint" />
          <Stat value={`${open.length}`} label="Still open" tone="faint" />
          <Stat value={`${overdue.length}`} label="Overdue" tone={overdue.length > 0 ? "warn" : "faint"} />
        </div>
        {rate === null && (
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] text-[var(--color-faint)]">
            No closed commitments yet — the rate appears once you have marked some kept or broken.
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <CardHead title="Make a promise" />
        <form action={addCommitment} className="grid gap-4 px-5 py-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_form" value="commitment" />
          <Field label="What are you committing to?">
            <input name="text" required placeholder="Specific enough to be checked" />
          </Field>
          <Field label="Area">
            <select name="area" defaultValue="deen">
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Due"><input name="dueOn" type="date" defaultValue={today} /></Field>
          <button type="submit"
            className="h-[38px] rounded bg-[var(--color-deen-dim)] px-4 text-[0.82rem] transition-colors hover:bg-[var(--color-deen)]/40">
            Add
          </button>
        </form>
      </Card>

      {overdue.length > 0 && (
        <Card className="mb-5">
          <CardHead title="Overdue" sub="Still open, past their date" />
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {overdue.map((c) => <CommitmentRow key={c.id} c={c} overdue />)}
          </ul>
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
            Listed as fact. Mark them honestly — a broken promise recorded is worth more than an open
            one you quietly stopped looking at.
          </p>
        </Card>
      )}

      <Card className="mb-5">
        <CardHead title="Due today" sub={fmtLongDate(today, settings.timezone)} />
        {dueToday.length === 0 ? <Empty>Nothing due today.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {dueToday.map((c) => <CommitmentRow key={c.id} c={c} />)}
          </ul>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card className="mb-5">
          <CardHead title="Upcoming" />
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {upcoming.map((c) => <CommitmentRow key={c.id} c={c} />)}
          </ul>
        </Card>
      )}

      <Card className="mb-5">
        <CardHead title="Goals" sub="Longer horizon than a promise" />
        <form action={addGoal} className="grid gap-4 border-b border-[var(--color-line-soft)] px-5 py-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_form" value="goal" />
          <Field label="Goal"><input name="title" required placeholder="What are you aiming at?" /></Field>
          <Field label="Area">
            <select name="category" defaultValue="deen">
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Target date"><input name="targetDate" type="date" /></Field>
          <button type="submit"
            className="h-[38px] rounded border border-[var(--color-line)] px-4 text-[0.82rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-deen-dim)]">
            Add
          </button>
        </form>
        {goals.length === 0 ? <Empty>No goals set.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {(goals as any[]).map((g) => <GoalRow key={g.id} g={g} />)}
          </ul>
        )}
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHead title="Recently closed" />
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {closed.map((c) => <CommitmentRow key={c.id} c={c} />)}
          </ul>
        </Card>
      )}
    </Shell>
  );
}
