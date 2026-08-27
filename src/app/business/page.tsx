import { requirePage } from "@/lib/page-auth";
import { loadSettings } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { todayIn, weekStart, addDays } from "@/lib/dates";
import { addProject, logBusinessActivity } from "@/app/actions";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";
import { Field } from "@/components/Check";

export const dynamic = "force-dynamic";

/* A general businesses-and-projects module. ChnoKain is one row in
   it, seeded at signup — not a special case in the code, because
   there will be others. */
export default async function Business() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const wk = weekStart(today, settings.weeklyReviewWeekday);
  const db = await getDb();

  const [projects, weekRows, recent] = await Promise.all([
    db.select().from(schema.projects).where(eq(schema.projects.userId, userId))
      .orderBy(desc(schema.projects.createdAt)),
    db.select().from(schema.businessMetrics).where(and(
      eq(schema.businessMetrics.userId, userId),
      gte(schema.businessMetrics.date, wk), lte(schema.businessMetrics.date, today))),
    db.select().from(schema.businessMetrics).where(eq(schema.businessMetrics.userId, userId))
      .orderBy(desc(schema.businessMetrics.date), desc(schema.businessMetrics.id)).limit(20),
  ]);

  const active = (projects as any[]).filter((p) => p.status === "active");
  const count = (rows: any[]) => rows.reduce((a, r) =>
    a + r.businessesContacted + r.businessesVisited + r.meetings + r.leads + r.followUps, 0);

  return (
    <Shell active="/business" wide>
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Businesses & projects</h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          Basic logging only for now. Each project carries its own priority tier and weekly target, so
          a new venture is a row here rather than a change to the app.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="This week" sub={`week beginning ${wk}`} />
        {active.length === 0 ? <Empty>No active projects.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {active.map((p) => {
              const rows = (weekRows as any[]).filter((r) => r.projectId === p.id);
              const n = count(rows);
              const pct = p.weeklyTarget > 0 ? Math.min(100, (n / p.weeklyTarget) * 100) : 0;
              return (
                <li key={p.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.9rem]">
                      {p.name}
                      <span className="ml-2 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.65rem] text-[var(--color-faint)]">
                        Priority {p.tier}
                      </span>
                    </span>
                    <span className="tnum text-[0.78rem] text-[var(--color-faint)]">
                      {n} of {p.weeklyTarget} this week
                    </span>
                  </div>
                  {p.role && <p className="mt-1 text-[0.75rem] text-[var(--color-faint)]">{p.role}</p>}
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--color-line)]">
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: pct >= 70 ? "var(--color-deen)" : "var(--color-gold)" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          Business carries the smallest weight in the daily score by design. It is a long-range vision,
          not a daily pressure metric — raise its weight in Settings when that genuinely changes.
        </p>
      </Card>

      {active.length > 0 && (
        <Card className="mb-5">
          <CardHead title="Log activity" />
          <form action={logBusinessActivity} className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <input type="hidden" name="_form" value="bizlog" />
            <Field label="Project">
              <select name="projectId" defaultValue={active[0]?.id}>
                {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Date"><input name="date" type="date" defaultValue={today} /></Field>
            <Field label="Businesses contacted">
              <input name="businessesContacted" type="number" min="0" defaultValue="0" />
            </Field>
            <Field label="Visited"><input name="businessesVisited" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Meetings"><input name="meetings" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Leads"><input name="leads" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Follow-ups"><input name="followUps" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Revenue (MAD)"><input name="revenue" type="number" min="0" /></Field>
            <Field label="Notes"><input name="notes" placeholder="Optional" /></Field>
            <div className="sm:col-span-3">
              <button type="submit"
                className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.82rem] transition-colors hover:bg-[var(--color-deen)]/40">
                Log activity
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-5">
        <CardHead title="Add a project" />
        <form action={addProject} className="grid gap-4 px-5 py-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_form" value="project" />
          <Field label="Name"><input name="name" required placeholder="New venture" /></Field>
          <Field label="Priority tier">
            <select name="tier" defaultValue="C">
              <option value="A">A — primary</option>
              <option value="B">B — equal weight</option>
              <option value="C">C — important but secondary</option>
            </select>
          </Field>
          <Field label="Weekly target"><input name="weeklyTarget" type="number" min="1" defaultValue="3" /></Field>
          <button type="submit"
            className="h-[38px] rounded border border-[var(--color-line)] px-4 text-[0.82rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-deen-dim)]">
            Add
          </button>
        </form>
      </Card>

      <Card>
        <CardHead title="Recent activity" />
        {(recent as any[]).length === 0 ? <Empty>Nothing logged yet.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {(recent as any[]).map((r) => {
              const p = (projects as any[]).find((x) => x.id === r.projectId);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5 text-[0.8rem]">
                  <span className="tnum w-20 text-[0.75rem] text-[var(--color-faint)]">{r.date}</span>
                  <span>{p?.name ?? "—"}</span>
                  <span className="text-[0.75rem] text-[var(--color-faint)]">
                    {r.businessesContacted > 0 && `${r.businessesContacted} contacted `}
                    {r.businessesVisited > 0 && `${r.businessesVisited} visited `}
                    {r.meetings > 0 && `${r.meetings} meetings `}
                    {r.leads > 0 && `${r.leads} leads `}
                    {r.followUps > 0 && `${r.followUps} follow-ups`}
                  </span>
                  {r.notes && <span className="text-[0.75rem] text-[var(--color-faint)]">· {r.notes}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
