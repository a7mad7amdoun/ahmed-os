import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadRange } from "@/lib/data";
import { todayIn, addDays } from "@/lib/dates";
import { detectPatterns } from "@/lib/patterns";
import { streaks } from "@/lib/scoring";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Insights() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const facts = await loadRange(userId, addDays(today, -89), today);
  const last30 = facts.slice(-30);
  const report = detectPatterns(facts as any);

  const logged = facts.filter((f) => f.checkedIn);
  const prayerStreak = streaks(facts, (f) => (f.prayersPerformed ?? 0) === 5);
  const quranStreak = streaks(facts, (f) => (f.quranPages ?? 0) > 0);
  const checkStreak = streaks(facts, (f) => f.checkedIn);

  const avgOf = (get: (f: (typeof facts)[number]) => number | null) => {
    const v = last30.map(get).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const avgSleep = avgOf((f) => f.sleepMinutes);
  const avgFoundation = avgOf((f) => f.foundationPct);
  const avgOverall = avgOf((f) => f.overallPct);
  const gatedDays = last30.filter((f) => f.gated).length;

  const fajrRate = (() => {
    const v = last30.map((f) => f.fajrOnTime).filter((x): x is boolean => x !== null);
    return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : null;
  })();

  return (
    <Shell active="/insights">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Pattern insights</h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          Everything here comes from days you logged yourself. Where there is not enough data, this
          page says so rather than guessing.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="Last 30 days" sub={`${logged.length} logged of ${facts.length} tracked`} />
        <div className="flex flex-wrap gap-x-10 gap-y-5 px-5 py-4">
          <Stat value={`${prayerStreak.current}`} label={`All five prayers · longest ${prayerStreak.longest}`}
            tone={prayerStreak.current > 0 ? "deen" : "faint"} />
          <Stat value={`${quranStreak.current}`} label={`Qur'an · longest ${quranStreak.longest}`}
            tone={quranStreak.current > 0 ? "deen" : "faint"} />
          <Stat value={`${checkStreak.current}`} label={`Checked in · longest ${checkStreak.longest}`} tone="faint" />
          <Stat value={avgSleep ? `${(avgSleep / 60).toFixed(1)}h` : "—"} label="Average sleep"
            tone={avgSleep && avgSleep >= 390 ? "deen" : avgSleep ? "warn" : "faint"} />
          <Stat value={fajrRate !== null ? `${fajrRate}%` : "—"} label="Fajr on time"
            tone={fajrRate !== null && fajrRate >= 50 ? "deen" : fajrRate !== null ? "warn" : "faint"} />
          <Stat value={avgOverall !== null ? `${Math.round(avgOverall)}%` : "—"} label="Average overall" />
        </div>
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          Current and longest streaks are tracked separately. A current streak of zero does not erase a
          longest streak — what you did happened, and it stays on the record.
          {gatedDays > 0 && (
            <> On {gatedDays} of the last 30 days the Foundation cap bound the Overall score: work was
            carrying a day the foundation was not.</>
          )}
        </p>
      </Card>

      <Card className="mb-5">
        <CardHead title="Foundation, last 30 days"
          sub={avgFoundation !== null ? `average ${Math.round(avgFoundation)}%` : undefined} />
        <div className="px-5 py-5"><Bars facts={last30} /></div>
      </Card>

      <Card className="mb-5">
        <CardHead title="Category averages" sub="Last 30 logged days" />
        <ul className="divide-y divide-[var(--color-line-soft)]">
          {CATEGORIES.map((key) => {
            const vals = last30.map((f) => f.categories[key])
              .filter((x): x is number => x !== null && x !== undefined);
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            return (
              <li key={key} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-24 shrink-0 text-[0.8rem] text-[var(--color-muted)]">
                  {CATEGORY_LABELS[key].en}
                </span>
                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                  <span className="block h-full rounded-full" style={{
                    width: `${avg ?? 0}%`,
                    background: avg === null ? "transparent"
                      : avg >= 70 ? "var(--color-deen)"
                      : avg >= 40 ? "var(--color-warn)" : "var(--color-alert)",
                  }} />
                </span>
                <span className="tnum w-16 shrink-0 text-right text-[0.75rem] text-[var(--color-faint)]">
                  {avg === null ? "no data" : `${Math.round(avg)}%`}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mb-5">
        <CardHead title="Observed patterns" />
        {!report.ready ? (
          <Empty>
            {report.daysCollected} of {report.daysNeeded} logged days collected. Comparisons need at
            least five days on each side before they mean anything, so nothing is shown yet.
          </Empty>
        ) : report.insights.length === 0 ? (
          <Empty>
            Enough data, but no difference large enough to be worth reporting. That is a real result.
          </Empty>
        ) : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {report.insights.map((i) => (
              <li key={i.key} className="px-5 py-4">
                <p className="text-[0.88rem] leading-relaxed">{i.text}</p>
                <p className="mt-1.5 text-[0.72rem] text-[var(--color-faint)]">
                  {i.sample}{i.strength === "weak" && " · small sample, treat as provisional"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          These are observed differences between groups of your own days. They are not causes.
        </p>
      </Card>
    </Shell>
  );
}

function Bars({ facts }: { facts: { date: string; foundationPct: number | null; checkedIn: boolean }[] }) {
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {facts.map((f) => {
          const pct = f.foundationPct ?? 0;
          const h = f.checkedIn ? Math.max(4, Math.round((pct / 100) * 96)) : 3;
          const color = !f.checkedIn ? "var(--color-line)"
            : pct >= 70 ? "var(--color-deen)"
            : pct >= 40 ? "var(--color-warn)" : "var(--color-alert)";
          return (
            <div key={f.date} className="flex-1 rounded-t-[2px]"
              style={{ height: `${h}px`, background: color, minWidth: "4px" }}
              title={`${f.date} — ${f.checkedIn ? `${Math.round(pct)}%` : "not logged"}`} />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.7rem] text-[var(--color-faint)]">
        <L color="var(--color-deen)" label="Held (70%+)" />
        <L color="var(--color-warn)" label="Slipped (40–70%)" />
        <L color="var(--color-alert)" label="Did not hold" />
        <L color="var(--color-line)" label="Not logged" />
      </div>
    </div>
  );
}

function L({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-[1px]" style={{ background: color }} />{label}
    </span>
  );
}
