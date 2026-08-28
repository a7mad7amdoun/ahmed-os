import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadRange } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { todayIn, addDays, weekStart, fmtLongDate } from "@/lib/dates";
import { CATEGORIES, CATEGORY_LABELS, type CategoryKey } from "@/lib/categories";
import { saveWeeklyReview } from "@/app/actions";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";
import CommitmentRow from "../commitments/CommitmentRow";
import { WeeklyBars, FoundationVsLife } from "@/components/charts";

export const dynamic = "force-dynamic";

/* The order matters: promises first, before any reflection. It is
   harder to write a comfortable narrative about your week directly
   underneath a list of what you said you would do. */
const QUESTIONS = [
  { key: "well", q: "What went well?" },
  { key: "badly", q: "What went badly?" },
  { key: "pattern", q: "What pattern repeated?" },
  { key: "excuses", q: "What excuses did I use?" },
  { key: "cause", q: "What was the real cause?" },
  { key: "change", q: "What needs to change?" },
  { key: "stop", q: "What should I stop doing?" },
  { key: "continue", q: "What should I continue doing?" },
  { key: "start", q: "What should I start doing?" },
  { key: "allah", q: "How was my relationship with Allah this week?", ar: "مع الله" },
  { key: "family", q: "Did I fulfil my family responsibilities?", ar: "الأهل" },
  { key: "learned", q: "What did I learn?" },
];

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export default async function Weekly({
  searchParams,
}: { searchParams: Promise<{ saved?: string; week?: string }> }) {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const sp = await searchParams;
  const today = todayIn(settings.timezone);
  const wkStart = sp.week ?? weekStart(today, settings.weeklyReviewWeekday);
  const wkEnd = addDays(wkStart, 6);
  const prevStart = addDays(wkStart, -7);
  const fourStart = addDays(wkStart, -28);

  const db = await getDb();
  const [thisWeek, prevWeek, fourWeeks, madeLastWeek, existing] = await Promise.all([
    loadRange(userId, wkStart, wkEnd > today ? today : wkEnd),
    loadRange(userId, prevStart, addDays(prevStart, 6)),
    loadRange(userId, fourStart, addDays(wkStart, -1)),
    db.select().from(schema.commitments).where(and(
      eq(schema.commitments.userId, userId),
      gte(schema.commitments.madeOn, prevStart), lte(schema.commitments.madeOn, wkEnd))),
    db.select().from(schema.weeklyReviews).where(and(
      eq(schema.weeklyReviews.userId, userId), eq(schema.weeklyReviews.weekStart, wkStart))).limit(1),
  ]);

  const answers = (existing[0]?.answers ?? {}) as Record<string, string>;
  const promises = madeLastWeek as any[];
  const kept = promises.filter((c) => c.status === "kept");
  const broken = promises.filter((c) => c.status === "broken");
  const stillOpen = promises.filter((c) => c.status === "open");
  const rate = promises.length - stillOpen.length > 0
    ? Math.round((kept.length / (promises.length - stillOpen.length)) * 100) : null;

  const logged = thisWeek.filter((d) => d.checkedIn).length;
  const isFriday = new Date(today + "T12:00:00Z").getUTCDay() === settings.weeklyReviewWeekday;

  const rows = CATEGORIES.map((k: CategoryKey) => ({
    key: k,
    label: CATEGORY_LABELS[k].en,
    now: avg(thisWeek.map((d) => d.categories[k])),
    prev: avg(prevWeek.map((d) => d.categories[k])),
    four: avg(fourWeeks.map((d) => d.categories[k])),
  }));

  const foundationNow = avg(thisWeek.map((d) => d.foundation));
  const foundationPrev = avg(prevWeek.map((d) => d.foundation));
  const overallNow = avg(thisWeek.map((d) => d.foundation));
  const overallPrev = avg(prevWeek.map((d) => d.foundation));

  return (
    <Shell active="/weekly" wide>
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Weekly review</h1>
        <p className="mt-2 text-[0.82rem] text-[var(--color-faint)]">
          {fmtLongDate(wkStart, settings.timezone)} → {fmtLongDate(wkEnd, settings.timezone)}
          <span className="mx-1.5 text-[var(--color-line)]">·</span>
          {logged} of 7 days logged
          {!isFriday && <span className="ml-1.5">· your review day is Friday</span>}
        </p>
      </header>

      {sp.saved && (
        <p className="mb-5 rounded border border-[var(--color-deen-dim)] bg-[var(--color-deen-dim)]/20 px-4 py-2.5 text-[0.82rem] text-[var(--color-deen)]">
          Review saved.
        </p>
      )}

      {/* Promises first — before any reflection. */}
      <Card className="mb-5">
        <CardHead title="Did I keep my promises?" sub="Pulled from what you actually committed to" />
        {promises.length === 0 ? (
          <Empty>
            No commitments were recorded for this period. This section becomes the sharpest part of the
            review once you start making promises in the Promises page or through a Reset.
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-4 px-5 py-4">
              <Stat value={rate === null ? "—" : `${rate}%`} label="Kept, of those closed"
                tone={rate === null ? "faint" : rate >= 70 ? "deen" : rate >= 40 ? "warn" : "faint"} />
              <Stat value={`${kept.length}`} label="Kept" tone={kept.length > 0 ? "deen" : "faint"} />
              <Stat value={`${broken.length}`} label="Broken" tone={broken.length > 0 ? "warn" : "faint"} />
              <Stat value={`${stillOpen.length}`} label="Never closed" tone="faint" />
            </div>
            <ul className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)]">
              {promises.map((c) => <CommitmentRow key={c.id} c={c} overdue={c.status === "open" && c.dueOn < today} />)}
            </ul>
            {stillOpen.length > 0 && (
              <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
                {stillOpen.length} promise{stillOpen.length === 1 ? "" : "s"} never got closed either way.
                Close them now — an unanswered promise is the most comfortable kind, and the least useful.
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="mb-5">
        <CardHead title="Overall, day by day" sub="This week" />
        <div className="px-3 py-4">
          <WeeklyBars data={thisWeek.map((d) => ({
            day: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: settings.timezone })
              .format(new Date(d.date + "T12:00:00Z")),
            value: d.foundation, logged: d.checkedIn,
          }))} />
        </div>
      </Card>

      <Card className="mb-5">
        <CardHead title="Foundation vs Life Progress" sub="This week and last" />
        <div className="px-3 py-4">
          <FoundationVsLife data={[...prevWeek, ...thisWeek].map((d) => ({
            date: d.date, foundation: d.foundation * 5, life: d.responsibility * 5,
          }))} />
        </div>
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          Both lines share one axis, both are percentages. Gaps are days you did not log — the line
          breaks rather than drawing through them, because an interpolated day did not happen.
        </p>
      </Card>

      <Card className="mb-5">
        <CardHead title="This week vs last vs four-week average" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-[0.8rem]">
            <thead>
              <tr className="border-b border-[var(--color-line-soft)] text-[0.72rem] uppercase tracking-wide text-[var(--color-faint)]">
                <th className="px-5 py-2.5 text-left font-medium">Category</th>
                <th className="px-3 py-2.5 text-right font-medium">This week</th>
                <th className="px-3 py-2.5 text-right font-medium">Last week</th>
                <th className="px-3 py-2.5 text-right font-medium">4-week avg</th>
                <th className="px-5 py-2.5 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Foundation" now={foundationNow} prev={foundationPrev}
                four={avg(fourWeeks.map((d) => d.foundation))} bold />
              <Row label="Foundation (avg)" now={overallNow} prev={overallPrev}
                four={avg(fourWeeks.map((d) => d.foundation))} bold />
              {rows.map((r) => (
                <Row key={r.key} label={r.label} now={r.now} prev={r.prev} four={r.four} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          A dash means there was nothing logged to average. Comparing against an empty week would
          manufacture a trend that does not exist.
        </p>
      </Card>

      <form action={saveWeeklyReview} className="space-y-4">
        <input type="hidden" name="_form" value="weekly" />
        <input type="hidden" name="weekStart" value={wkStart} />

        {QUESTIONS.map((q) => (
          <div key={q.key} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
            <label htmlFor={`q_${q.key}`} className="block text-[0.88rem] leading-snug text-[var(--color-text)]">
              {q.q}{q.ar && <span className="ar ml-2 text-[var(--color-faint)]">{q.ar}</span>}
            </label>
            <textarea id={`q_${q.key}`} name={`q_${q.key}`} defaultValue={answers[q.key] ?? ""} className="mt-2.5" />
          </div>
        ))}

        <div className="rounded-lg border border-[var(--color-deen-dim)] bg-[var(--color-surface)] px-5 py-4">
          <label htmlFor="biggestPriority" className="block text-[0.92rem] text-[var(--color-text)]">
            The ONE biggest priority for next week
          </label>
          <p className="mt-1 text-[0.72rem] text-[var(--color-faint)]">
            One. A list of five priorities is a list of none.
          </p>
          <input id="biggestPriority" name="biggestPriority"
            defaultValue={existing[0]?.biggestPriority ?? ""} className="mt-2.5" />
        </div>

        <button type="submit"
          className="mb-10 rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
          Save weekly review
        </button>
      </form>
    </Shell>
  );
}

function Row({ label, now, prev, four, bold }: {
  label: string; now: number | null; prev: number | null; four: number | null; bold?: boolean;
}) {
  const d = now !== null && prev !== null ? now - prev : null;
  const fmt = (n: number | null) => n === null ? "—" : `${Math.round(n)}/20`;
  return (
    <tr className={`border-b border-[var(--color-line-soft)] ${bold ? "font-medium" : ""}`}>
      <td className="px-5 py-2">{label}</td>
      <td className="tnum px-3 py-2 text-right">{fmt(now)}</td>
      <td className="tnum px-3 py-2 text-right text-[var(--color-faint)]">{fmt(prev)}</td>
      <td className="tnum px-3 py-2 text-right text-[var(--color-faint)]">{fmt(four)}</td>
      <td className="tnum px-5 py-2 text-right"
        style={{ color: d === null ? "var(--color-faint)" : d > 1 ? "var(--color-deen)" : d < -1 ? "var(--color-warn)" : "var(--color-faint)" }}>
        {d === null ? "—" : `${d > 0 ? "+" : ""}${Math.round(d)}`}
      </td>
    </tr>
  );
}
