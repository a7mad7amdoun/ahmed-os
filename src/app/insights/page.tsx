import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadFacts } from "@/lib/data";
import { todayIn, addDays } from "@/lib/dates";
import { detectPatterns, streak } from "@/lib/patterns";
import { Shell, Card, CardHead, Stat, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Insights() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const facts = await loadFacts(userId, addDays(today, -89), today);
  const last30 = facts.slice(-30);
  const report = detectPatterns(facts);

  const logged = facts.filter((f) => f.checkedIn);
  const prayerStreak = streak(facts, (f) => (f.prayersPerformed ?? 0) === 5);
  const quranStreak = streak(facts, (f) => (f.quranPages ?? 0) > 0);
  const checkStreak = streak(facts, (f) => f.checkedIn);

  const avgSleep = (() => {
    const v = last30.map((f) => f.sleepMinutes).filter((x): x is number => x !== null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length / 60).toFixed(1) : null;
  })();
  const fajrRate = (() => {
    const v = last30.map((f) => f.fajrOnTime).filter((x): x is boolean => x !== null);
    return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : null;
  })();

  return (
    <Shell active="/insights">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Pattern insights</h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          Everything here comes from days you logged yourself. Where there is not enough data, this page
          says so rather than guessing — a confident-sounding conclusion drawn from six days would be worse
          than no conclusion.
        </p>
      </header>

      <Card className="mb-5">
        <CardHead title="Last 30 days" sub={`${logged.length} logged of ${facts.length} tracked`} />
        <div className="flex flex-wrap gap-x-10 gap-y-5 px-5 py-4">
          <Stat value={prayerStreak ? `${prayerStreak}` : "0"} label="Day streak · all five prayers"
            tone={prayerStreak > 0 ? "deen" : "faint"} />
          <Stat value={quranStreak ? `${quranStreak}` : "0"} label="Day streak · Qur'an"
            tone={quranStreak > 0 ? "deen" : "faint"} />
          <Stat value={checkStreak ? `${checkStreak}` : "0"} label="Day streak · checked in" tone="faint" />
          <Stat value={avgSleep ? `${avgSleep}h` : "—"} label="Average sleep"
            tone={avgSleep && Number(avgSleep) >= 6.5 ? "deen" : avgSleep ? "warn" : "faint"} />
          <Stat value={fajrRate !== null ? `${fajrRate}%` : "—"} label="Fajr on time"
            tone={fajrRate !== null && fajrRate >= 50 ? "deen" : fajrRate !== null ? "warn" : "faint"} />
        </div>
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          A streak at zero is information, not a verdict. It resets to one the moment you log a day —
          there is nothing to earn back first.
        </p>
      </Card>

      <Card className="mb-5">
        <CardHead title="Foundation, last 30 days" />
        <div className="px-5 py-5">
          <Sparkline facts={last30} />
        </div>
      </Card>

      <Card className="mb-5">
        <CardHead title="Observed patterns" />
        {!report.ready ? (
          <Empty>
            {report.daysCollected} of {report.daysNeeded} logged days collected. Comparisons need at least
            five days on each side before they mean anything, so nothing is shown yet.
          </Empty>
        ) : report.insights.length === 0 ? (
          <Empty>
            Enough data, but no difference large enough to be worth reporting. That is a real result —
            it means no single factor is dominating your days yet.
          </Empty>
        ) : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {report.insights.map((i) => (
              <li key={i.key} className="px-5 py-4">
                <p className="text-[0.88rem] leading-relaxed">{i.text}</p>
                <p className="mt-1.5 text-[0.72rem] text-[var(--color-faint)]">
                  {i.sample}
                  {i.strength === "weak" && " · small sample, treat as provisional"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          These are observed differences between groups of your own days. They are not causes.
          Sleeping more may improve your Fajr, or the same underlying thing may drive both.
        </p>
      </Card>
    </Shell>
  );
}

/** Bars, not a line: a missing day should read as a gap, not be
 *  interpolated over as though it happened. */
function Sparkline({ facts }: { facts: { date: string; foundationPct: number | null; checkedIn: boolean }[] }) {
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {facts.map((f) => {
          const pct = f.foundationPct ?? 0;
          const h = f.checkedIn ? Math.max(4, Math.round(pct * 96)) : 3;
          const color = !f.checkedIn ? "var(--color-line)"
            : pct >= 0.7 ? "var(--color-deen)"
            : pct >= 0.4 ? "var(--color-warn)" : "var(--color-alert)";
          return (
            <div key={f.date} className="flex-1 rounded-t-[2px]"
              style={{ height: `${h}px`, background: color, minWidth: "4px" }}
              title={`${f.date} — ${f.checkedIn ? `${Math.round(pct * 100)}%` : "not logged"}`} />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.7rem] text-[var(--color-faint)]">
        <Legend color="var(--color-deen)" label="Foundation held (70%+)" />
        <Legend color="var(--color-warn)" label="Slipped (40–70%)" />
        <Legend color="var(--color-alert)" label="Did not hold" />
        <Legend color="var(--color-line)" label="Not logged" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-[1px]" style={{ background: color }} />{label}
    </span>
  );
}
