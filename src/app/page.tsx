import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadDay, loadSettings, refreshPrayerStatuses, pendingRecovery } from "@/lib/data";
import { buildDayScores, persistScores } from "@/lib/day-scores";
import { todayIn, fmtLongDate, hijriDate, partsIn } from "@/lib/dates";
import { CATEGORIES } from "@/lib/categories";
import { MAJORS } from "@/lib/scoring";
import { Shell, Card, CardHead } from "@/components/ui";
import { StatusPill } from "@/components/scores";
import CategoryAccordion from "@/components/CategoryAccordion";
import PrayerStrip from "@/components/PrayerStrip";
import RecoveryPinned from "@/components/RecoveryPinned";

export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "The night is still yours";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function Today() {
  const { userId, name } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);

  await refreshPrayerStatuses(userId, today);
  const bundle = await buildDayScores(userId, today);
  // Store as we go, so the day's numbers exist in the log even if the
  // only thing logged was a prayer.
  await persistScores(userId, today, bundle);

  const s = await loadDay(userId, today);
  const recovery = await pendingRecovery(userId, today);
  const sc = bundle.scores;
  const { hour } = partsIn(settings.timezone, s.now);

  const performed = s.prayers.filter((p) => p.status === "on_time" || p.status === "late").length;
  const onTime = s.prayers.filter((p) => p.status === "on_time").length;
  const weak = sc.overallStatus === "critical" || sc.overallStatus === "below_standard";

  return (
    <Shell active="/" wide>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--color-line-soft)] pb-6">
        <div>
          <p className="ar text-[1.05rem] text-[var(--color-deen)]">السلام عليكم</p>
          <h1 className="mt-1 font-[family-name:var(--font-serif)] text-[1.7rem] leading-tight sm:text-[2rem]">
            {greeting(hour)}, {name}.
          </h1>
          <p className="mt-1.5 text-[0.82rem] text-[var(--color-faint)]">
            {fmtLongDate(today, settings.timezone)}
            {hijriDate(today) && <span className="ar"> · {hijriDate(today)}</span>}
            <span className="mx-1.5 text-[var(--color-line)]">·</span>{settings.city}
          </p>
        </div>
        <p className="text-[0.75rem] text-[var(--color-faint)]">
          {sc.loggedSubs} of {sc.totalSubs} sub-habits logged today
        </p>
      </header>

      {recovery.length > 0 && <RecoveryPinned groups={recovery} className="mb-5" />}

      {/* ── Seven rows. Tap one open to log; it expands in place. ── */}
      <div className="space-y-2.5">
        {CATEGORIES.map((k) => (
          <CategoryAccordion
            key={k}
            date={today}
            category={sc.categories[k]}
            derivedKeys={[...bundle.derivedKeys]}
          />
        ))}
      </div>

      <p className="mt-3 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
        You do not have to fill all seven in one sitting. Log a prayer when you pray it, Work at
        the end of your work block, Health at night. Nothing here expects a perfect day.
      </p>

      {/* ── Prayers: tapped as they happen, they feed Deen ── */}
      <Card className="mt-5">
        <CardHead title="Prayer log" ar="الصلوات الخمس"
          sub={`${performed}/5 prayed · ${onTime}/5 on time · Deen ceiling ${
            sc.categories.deen.ceiling ?? 20}`} />
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
        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
          Each prayer scores on its own five-step scale — missed 0, late 8, on time 14, in
          congregation 17, at the mosque 20 — and together they set the ceiling for the whole
          Deen category. Times use Fajr {Number(settings.fajrAngle)}° / Isha{" "}
          {Number(settings.ishaAngle)}°, on-time window {settings.onTimeWindowMinutes} min.
        </p>
      </Card>

      {/* ── The three, never merged ── */}
      <div className="mt-6 border-t border-[var(--color-line-soft)] pt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {MAJORS.map((k) => {
            const m = sc.majors[k];
            const isWeak = m.key === sc.weakest.key;
            return (
              <div key={k}
                className="rounded-lg border bg-[var(--color-surface)] px-5 py-4"
                style={{ borderColor: isWeak ? "var(--color-warn)" : "var(--color-line)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.7rem] uppercase tracking-[0.13em] text-[var(--color-muted)]">
                    {m.label}
                  </span>
                  {isWeak && (
                    <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-warn)]">
                      weakest
                    </span>
                  )}
                </div>
                <p className="tnum mt-2 text-[2rem] font-medium leading-none">
                  {m.score}<span className="ml-1 text-[0.9rem] text-[var(--color-faint)]">/20</span>
                </p>
                <div className="mt-2.5"><StatusPill status={m.status} /></div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
          <p className="text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-faint)]">
            Overall status
          </p>
          <p className="mt-1.5 text-[1.15rem]"
            style={{ color: weak ? "var(--color-warn)" : "var(--color-deen)" }}>
            {sc.overallStatusLabel}
            <span className="ml-2 text-[0.85rem] text-[var(--color-faint)]">
              — {sc.bottleneckLine}
            </span>
          </p>
          <p className="mt-2 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
            This is the status of the <strong>weakest</strong> of the three, never an average of
            them. Averaging would let a strong day at work hide a foundation that did not hold,
            which is the one thing this app exists to prevent.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="text-[0.9rem]">{sc.evaluation.headline}</p>
            <p className="mt-0.5 text-[0.78rem] leading-relaxed text-[var(--color-faint)]">
              {sc.evaluation.note}
            </p>
          </div>
          <Link href="/reset"
            className={`shrink-0 rounded px-5 py-2.5 text-[0.82rem] tracking-wide transition-colors ${
              sc.evaluation.suggestReset
                ? "bg-[var(--color-deen-dim)] text-[var(--color-text)] hover:bg-[var(--color-deen)]/40"
                : "border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-deen-dim)]"}`}>
            🔄 Reset today
          </Link>
        </div>
      </div>
    </Shell>
  );
}
