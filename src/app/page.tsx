import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadDay, loadRange, loadSettings, refreshPrayerStatuses, pendingRecovery } from "@/lib/data";
import { todayIn, addDays, fmtLongDate, hijriDate, partsIn } from "@/lib/dates";
import { detectPatterns } from "@/lib/patterns";
import { nextAction } from "@/lib/next-action";
import { streaks } from "@/lib/scoring";
import { Shell, Card, CardHead, ScoreBlock, Stat, Empty } from "@/components/ui";
import PrayerStrip from "@/components/PrayerStrip";
import RecoveryPinned from "@/components/RecoveryPinned";

export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "The night is still yours";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function Dashboard() {
  const { userId, name } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  await refreshPrayerStatuses(userId, today);

  const s = await loadDay(userId, today);
  const facts = await loadRange(userId, addDays(today, -29), today);
  const patterns = detectPatterns(facts as any);
  const action = nextAction(s);
  const recovery = await pendingRecovery(userId, today);

  const { hour } = partsIn(settings.timezone, s.now);
  const r = s.rollup;
  const performed = s.prayers.filter((p) => p.status === "on_time" || p.status === "late").length;
  const onTime = s.prayers.filter((p) => p.status === "on_time").length;
  const jamaah = s.prayers.filter((p) => p.jamaah).length;
  const mosque = s.prayers.filter((p) => p.mosque).length;

  const prayerStreak = streaks(facts, (f) => (f.prayersPerformed ?? 0) === 5);
  const quranStreak = streaks(facts, (f) => (f.quranPages ?? 0) > 0);
  const last7 = facts.slice(-7);
  const quranDays7 = last7.filter((f) => (f.quranPages ?? 0) > 0).length;

  const lastGood = [...facts].reverse().find((f) => (f.foundationPct ?? 0) >= 70);
  const daysSinceGood = lastGood
    ? facts.length - 1 - facts.findIndex((f) => f.date === lastGood.date) : null;

  const urgency = action.urgency === "now" ? "var(--color-deen)"
    : action.urgency === "today" ? "var(--color-gold)" : "var(--color-faint)";

  return (
    <Shell active="/">
      <header className="mb-7">
        <p className="ar text-[1.05rem] text-[var(--color-deen)]">السلام عليكم</p>
        <h1 className="mt-1 font-[family-name:var(--font-serif)] text-[1.6rem] leading-tight">
          {greeting(hour)}, {name}.
        </h1>
        <p className="mt-1.5 text-[0.82rem] text-[var(--color-faint)]">
          {fmtLongDate(today, settings.timezone)}
          {hijriDate(today) && <span className="ar"> · {hijriDate(today)}</span>}
          <span className="mx-1.5 text-[var(--color-line)]">·</span>{settings.city}
        </p>
      </header>

      {recovery.length > 0 && <RecoveryPinned groups={recovery} className="mb-5" />}

      <Card className="mb-5">
        <div className="flex flex-wrap items-start gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] tracking-[0.1em] uppercase" style={{ color: urgency }}>
              {action.urgency === "now" ? "Now" : action.urgency === "today" ? "Next" : "Nothing outstanding"}
            </p>
            <p className="mt-1.5 text-[1.05rem] leading-snug">{action.text}</p>
            <p className="mt-1 text-[0.8rem] text-[var(--color-faint)]">{action.why}</p>
          </div>
          {action.href && (
            <Link href={action.href}
              className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[0.78rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-deen-dim)]">
              Open
            </Link>
          )}
        </div>
      </Card>

      {/* Both scores are shown before the Overall figure, always. */}
      <Card className="mb-5">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[1.02rem]">{r.evaluation.headline}</h2>
            {daysSinceGood !== null && daysSinceGood > 0 && (
              <span className="text-[0.75rem] text-[var(--color-faint)]">
                Last day the foundation held: {daysSinceGood === 1 ? "yesterday" : `${daysSinceGood} days ago`}
              </span>
            )}
          </div>
          <p className="mt-1 text-[0.82rem] text-[var(--color-faint)]">{r.evaluation.note}</p>
        </div>

        <div className="grid gap-6 border-t border-[var(--color-line-soft)] px-5 py-5 sm:grid-cols-2">
          <ScoreBlock score={r.foundation} label="Foundation" ar="الأساس" tone="deen" />
          <ScoreBlock score={r.life} label="Life Progress" tone="growth" />
        </div>

        <div className="border-t border-[var(--color-line-soft)] px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[0.72rem] tracking-[0.1em] uppercase text-[var(--color-faint)]">
              Overall day
            </span>
            <span className="tnum text-[1.35rem] font-medium">
              {r.overallPct === null ? "—" : `${Math.round(r.overallPct)}%`}
            </span>
          </div>
          <p className="mt-1.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
            {r.overallPct === null ? (
              "Nothing logged yet today."
            ) : (
              <>
                One weighted mean of all eight categories — {Math.round(r.foundationShare * 100)}%
                of today&rsquo;s weight sits in Foundation — then capped at Foundation +{" "}
                {s.scoring.gateCapOffset}.{" "}
                {r.gated ? (
                  <>Blended it would be {Math.round(r.ungatedPct!)}%, but a Foundation of{" "}
                  {Math.round(r.foundation.pct ?? 0)}% holds the day to{" "}
                  {Math.round(r.gateCeiling!)}%. Work cannot lift a day the foundation did not hold.</>
                ) : (
                  <>The cap is not binding today.</>
                )}
              </>
            )}
          </p>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHead title="The five prayers" ar="الصلوات الخمس"
          sub={`${performed}/5 prayed · ${onTime}/5 on time`} />
        <PrayerStrip date={today} tz={settings.timezone} editable
          rows={s.prayers.map((p) => {
            const w = s.windows.find((x) => x.prayer === p.prayer)!;
            return {
              prayer: p.prayer, status: p.status, jamaah: p.jamaah, mosque: p.mosque,
              manualOverride: p.manualOverride,
              startISO: w.start.toISOString(), onTimeUntilISO: w.onTimeUntil.toISOString(),
              endISO: w.end.toISOString(),
              due: s.now >= w.start, windowClosed: s.now >= w.end,
            };
          })} />
        <div className="flex flex-wrap items-center gap-6 border-t border-[var(--color-line-soft)] px-5 py-3.5">
          <Stat value={`${performed}/5`} label="Prayed" tone={performed === 5 ? "deen" : "text"} />
          <Stat value={`${onTime}/5`} label="On time" tone={onTime >= 3 ? "deen" : onTime > 0 ? "warn" : "faint"} />
          <Stat value={`${jamaah}`} label="In congregation" ar="جماعة" tone="faint" />
          <Stat value={`${mosque}`} label="At the mosque" tone="faint" />
          <Stat value={`${prayerStreak.current}`} label={`Streak · longest ${prayerStreak.longest}`}
            tone={prayerStreak.current > 0 ? "deen" : "faint"} />
          <p className="ml-auto max-w-xs text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
            On-time window: {settings.onTimeWindowMinutes} min from when each prayer enters.
            Times use Fajr {Number(settings.fajrAngle)}° / Isha {Number(settings.ishaAngle)}°.
          </p>
        </div>
      </Card>

      {s.practiceDefs.length > 0 && (
        <Card className="mb-5">
          <CardHead title="Voluntary" ar="النوافل" sub="Optional — tracked apart, never a substitute" />
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {s.practiceDefs.map((d: any) => {
              const done = s.practices.find((p: any) => p.key === d.key)?.done;
              return (
                <span key={d.key}
                  className={`rounded border px-2.5 py-1 text-[0.76rem] ${
                    done ? "border-[var(--color-deen-dim)] text-[var(--color-deen)]"
                         : "border-[var(--color-line)] text-[var(--color-faint)]"}`}>
                  {d.label}{d.labelAr && <span className="ar ml-1.5">{d.labelAr}</span>}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHead title="Qur'an" ar="القرآن" />
          <div className="flex flex-wrap gap-7 px-5 py-4">
            <Stat value={s.quran ? `${Number(s.quran.pages)}` : "0"} label="Pages today"
              tone={s.quran && Number(s.quran.pages) > 0 ? "deen" : "faint"} />
            <Stat value={`${quranDays7}/7`} label="Days this week"
              tone={quranDays7 >= 3 ? "deen" : quranDays7 > 0 ? "warn" : "faint"} />
            <Stat value={`${quranStreak.current}`} label={`Streak · longest ${quranStreak.longest}`}
              tone={quranStreak.current > 0 ? "deen" : "faint"} />
          </div>
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
            {quranStreak.current === 0 && quranStreak.longest > 0
              ? `Your longest run is ${quranStreak.longest} days. That happened, and it stays on the record. One page today starts the next one.`
              : "Returning after a gap counts as much as never stopping."}
          </p>
        </Card>

        <Card>
          <CardHead title="Today" />
          <div className="space-y-3 px-5 py-4 text-[0.82rem]">
            <Line label="Priority" value={s.day.topPriority ?? "Not named"}
              ok={!!s.day.topPriorityDone} dim={!s.day.topPriority} />
            <Line label="Deep work"
              value={s.day.deepWorkMinutes === null ? "Not logged" : `${(s.day.deepWorkMinutes / 60).toFixed(1)}h`}
              ok={(s.day.deepWorkMinutes ?? 0) >= s.cfg.deepWorkTargetMinutes}
              dim={s.day.deepWorkMinutes === null} />
            <Line label="Sleep"
              value={s.sleep?.durationMinutes ? `${(s.sleep.durationMinutes / 60).toFixed(1)}h` : "Not logged"}
              ok={(s.sleep?.durationMinutes ?? 0) >= 360} dim={!s.sleep?.durationMinutes} />
            <Line label="Family" ar="الأهل"
              value={s.day.familyContact ? (s.day.familyNote ?? "Yes")
                : s.day.familyContact === false ? "Not yet today" : "Not logged"}
              ok={!!s.day.familyContact} dim={s.day.familyContact === null} />
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHead title="Categories today" sub="Each scored on its own inputs" />
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {Object.values(r.categories).map((c) => (
              <li key={c.key} className="flex items-center gap-3 px-5 py-2">
                <span className="w-24 shrink-0 text-[0.78rem] text-[var(--color-muted)]">
                  {c.label}{c.ar && <span className="ar ml-1.5 text-[var(--color-faint)]">{c.ar}</span>}
                </span>
                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                  <span className="block h-full rounded-full"
                    style={{
                      width: `${c.pct ?? 0}%`,
                      background: c.pct === null ? "transparent"
                        : c.pct >= 70 ? "var(--color-deen)"
                        : c.pct >= 40 ? "var(--color-warn)" : "var(--color-alert)",
                    }} />
                </span>
                <span className="tnum w-10 shrink-0 text-right text-[0.75rem] text-[var(--color-faint)]">
                  {c.pct === null ? "—" : `${Math.round(c.pct)}%`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHead title="Pattern insights" sub={patterns.ready ? "From your own logged days" : undefined} />
        {!patterns.ready ? (
          <Empty>
            Collecting data — {patterns.daysCollected} of {patterns.daysNeeded} logged days needed.
            Nothing will be claimed here until there is enough of your own history to justify it.
          </Empty>
        ) : patterns.insights.length === 0 ? (
          <Empty>No differences large enough to report yet. That is a finding, not a failure.</Empty>
        ) : (
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {patterns.insights.slice(0, 3).map((i) => (
              <li key={i.key} className="px-5 py-3.5">
                <p className="text-[0.85rem] leading-relaxed">{i.text}</p>
                <p className="mt-1 text-[0.72rem] text-[var(--color-faint)]">Based on {i.sample}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
        <div>
          <p className="text-[0.9rem]">
            {r.evaluation.suggestReset ? "Today slipped. Deal with it today." : "Had a bad day?"}
          </p>
          <p className="mt-0.5 text-[0.78rem] text-[var(--color-faint)]">
            A bad day is allowed. A delayed return is the real danger.
          </p>
        </div>
        <Link href="/reset"
          className={`rounded px-4 py-2 text-[0.8rem] tracking-wide transition-colors ${
            r.evaluation.suggestReset
              ? "bg-[var(--color-deen-dim)] text-[var(--color-text)] hover:bg-[var(--color-deen)]/40"
              : "border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-deen-dim)]"}`}>
          🔄 Reset today
        </Link>
      </div>
    </Shell>
  );
}

function Line({ label, value, ok, dim, ar }: {
  label: string; value: string; ok?: boolean; dim?: boolean; ar?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-[0.75rem] text-[var(--color-faint)]">
        {label}{ar && <span className="ar ml-1">{ar}</span>}
      </span>
      <span className="h-1 w-1 shrink-0 rounded-full"
        style={{ background: dim ? "var(--color-line)" : ok ? "var(--color-deen)" : "var(--color-warn)" }} />
      <span className={dim ? "text-[var(--color-faint)]" : ""}>{value}</span>
    </div>
  );
}
