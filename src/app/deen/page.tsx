import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadRange } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { todayIn, addDays } from "@/lib/dates";
import { PRAYERS, PRAYER_LABELS } from "@/lib/prayer-times";
import { streaks } from "@/lib/scoring";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";
import { PrayerHeatmap, QuranArea, CategoryTrend } from "@/components/charts";

export const dynamic = "force-dynamic";

/* The Deen dashboard keeps obligatory and voluntary visually apart:
   the heatmap and the counts above it are the five prayers only.
   Voluntary practice is a separate card, further down, and the two
   are never summed. */
export default async function Deen() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const from = addDays(today, -29);
  const db = await getDb();

  const [facts, prayerRows, quranRows, practiceRows, defs] = await Promise.all([
    loadRange(userId, from, today),
    db.select().from(schema.prayers).where(and(eq(schema.prayers.userId, userId),
      gte(schema.prayers.date, addDays(today, -13)), lte(schema.prayers.date, today)))
      .orderBy(asc(schema.prayers.date)),
    db.select().from(schema.quranEntries).where(and(eq(schema.quranEntries.userId, userId),
      gte(schema.quranEntries.date, from), lte(schema.quranEntries.date, today)))
      .orderBy(asc(schema.quranEntries.date)),
    db.select().from(schema.practices).where(and(eq(schema.practices.userId, userId),
      gte(schema.practices.date, from), lte(schema.practices.date, today))),
    db.select().from(schema.practiceDefs).where(and(eq(schema.practiceDefs.userId, userId),
      eq(schema.practiceDefs.active, true))).orderBy(asc(schema.practiceDefs.sortOrder)),
  ]);

  // Two weeks of the five prayers, day by day.
  const heatDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, -13 + i);
    const cells: Record<string, string> = {};
    for (const p of PRAYERS) {
      cells[p] = (prayerRows as any[]).find((r) => r.date === date && r.prayer === p)?.status
        ?? "not_logged";
    }
    return {
      date,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: settings.timezone })
        .format(new Date(date + "T12:00:00Z")),
      cells,
    };
  });

  let running = 0;
  const quranSeries = facts.map((f) => {
    running += f.quranPages ?? 0;
    return { date: f.date, total: running };
  });

  const totalPages = running;
  const quranStreak = streaks(facts, (f) => (f.quranPages ?? 0) > 0);
  const prayerStreak = streaks(facts, (f) => (f.prayersPerformed ?? 0) === 5);
  const logged = facts.filter((f) => f.checkedIn);
  const daysRead = facts.filter((f) => (f.quranPages ?? 0) > 0).length;

  const onTimeTotal = facts.reduce((a, f) => a + (f.prayersOnTime ?? 0), 0);
  const performedTotal = facts.reduce((a, f) => a + (f.prayersPerformed ?? 0), 0);
  const possible = logged.length * 5;

  return (
    <Shell active="/deen" wide>
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Deen</h1>
          <span className="ar text-[1.15rem] text-[var(--color-deen)]">الدين</span>
        </div>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          The five prayers first and alone. Voluntary practice is tracked below them and is never
          added to the same total — a completed Sunnah cannot stand in for a missed Fard.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="The obligation" ar="الفرض" sub="Last 30 logged days" />
        <div className="flex flex-wrap gap-x-10 gap-y-4 px-5 py-4">
          <Stat value={possible ? `${performedTotal}/${possible}` : "—"} label="Prayers prayed"
            tone={performedTotal > 0 ? "deen" : "faint"} />
          <Stat value={possible ? `${Math.round((onTimeTotal / possible) * 100)}%` : "—"}
            label="On time"
            tone={possible && onTimeTotal / possible >= 0.5 ? "deen" : possible ? "warn" : "faint"} />
          <Stat value={`${prayerStreak.current}`} label={`Full-five streak · longest ${prayerStreak.longest}`}
            tone={prayerStreak.current > 0 ? "deen" : "faint"} />
        </div>
      </Card>

      <Card className="mb-5">
        <CardHead title="Prayer consistency" sub="Last 14 days" />
        <div className="px-5 py-4">
          <PrayerHeatmap days={heatDays}
            prayers={PRAYERS.map((p) => ({ key: p, label: PRAYER_LABELS[p].en }))} />
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="mb-5">
        <CardHead title="Qur'an" ar="القرآن"
          sub={`${totalPages} pages over ${daysRead} day${daysRead === 1 ? "" : "s"}`} />
        <div className="flex flex-wrap gap-x-10 gap-y-4 px-5 pt-4">
          <Stat value={`${totalPages}`} label="Pages, 30 days" tone={totalPages > 0 ? "deen" : "faint"} />
          <Stat value={`${daysRead}/30`} label="Days opened"
            tone={daysRead >= 10 ? "deen" : daysRead > 0 ? "warn" : "faint"} />
          <Stat value={`${quranStreak.current}`} label={`Streak · longest ${quranStreak.longest}`}
            tone={quranStreak.current > 0 ? "deen" : "faint"} />
        </div>
        <div className="px-3 pb-2 pt-3">
          {totalPages > 0 ? <QuranArea data={quranSeries} />
            : <Empty>No pages logged in the last 30 days. One page today starts the line.</Empty>}
        </div>
      </Card>

      <Card className="mb-5">
        <CardHead title="Deen score trend" sub="Last 30 days" />
        <div className="px-3 py-3">
          <CategoryTrend data={facts.map((f) => ({
            date: f.date, value: f.categories.deen ?? null,
          }))} />
        </div>
      </Card>
      </div>

      <Card>
        <CardHead title="Voluntary practice" ar="النوافل"
          sub="Optional — counted separately, always" />
        {defs.length === 0 ? <Empty>No voluntary practices configured.</Empty> : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {(defs as any[]).map((d) => {
              const done = (practiceRows as any[]).filter((p) => p.key === d.key && p.done).length;
              return (
                <li key={d.key} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-40 shrink-0 text-[0.82rem] text-[var(--color-muted)]">
                    {d.label}{d.labelAr && <span className="ar ml-1.5 text-[var(--color-faint)]">{d.labelAr}</span>}
                  </span>
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                    <span className="block h-full rounded-full bg-[var(--color-gold)]"
                      style={{ width: `${(done / 30) * 100}%` }} />
                  </span>
                  <span className="tnum w-12 shrink-0 text-right text-[0.75rem] text-[var(--color-faint)]">
                    {done}/30
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
