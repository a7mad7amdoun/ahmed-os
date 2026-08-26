import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadDay, loadFacts, refreshPrayerStatuses } from "@/lib/data";
import { todayIn, addDays, fmtLongDate, hijriDate, partsIn } from "@/lib/dates";
import { detectPatterns } from "@/lib/patterns";
import { nextAction } from "@/lib/next-action";
import { Shell, Card, CardHead, ScoreBlock, Stat, Empty } from "@/components/ui";
import PrayerStrip from "@/components/PrayerStrip";
import { loadSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "The night is still yours";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 20) return "Good evening";
  return "Good evening";
}

export default async function Dashboard() {
  const { userId, name } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);

  // Keep statuses honest even if the app sat open across a prayer time.
  await refreshPrayerStatuses(userId, today);

  const s = await loadDay(userId, today);
  const facts = await loadFacts(userId, addDays(today, -29), today);
  const patterns = detectPatterns(facts);
  const action = nextAction(s);

  const { hour } = partsIn(settings.timezone, s.now);
  const performed = s.prayers.filter((p) => p.status === "on_time" || p.status === "late").length;
  const onTime = s.prayers.filter((p) => p.status === "on_time").length;
  const jamaah = s.prayers.filter((p) => p.jamaah).length;
  const mosque = s.prayers.filter((p) => p.mosque).length;

  const last7 = facts.slice(-7);
  const quranDays7 = last7.filter((f) => (f.quranPages ?? 0) > 0).length;
  const totalPages30 = facts.reduce((a, f) => a + (f.quranPages ?? 0), 0);

  // Last day the foundation genuinely held — the honest "time since"
  // measure, with no shaming language attached to it.
  const lastGood = [...facts].reverse().find((f) => (f.foundationPct ?? 0) >= 0.7);
  const daysSinceGood = lastGood
    ? facts.length - 1 - facts.findIndex((f) => f.date === lastGood.date)
    : null;

  const urgencyColor = action.urgency === "now" ? "var(--color-deen)"
    : action.urgency === "today" ? "var(--color-gold)" : "var(--color-faint)";

  return (
    <Shell active="/">
      {/* ── Greeting ─────────────────────────────────────────── */}
      <header className="mb-7">
        <p className="ar text-[1.05rem] text-[var(--color-deen)]">السلام عليكم</p>
        <h1 className="mt-1 font-[family-name:var(--font-serif)] text-[1.6rem] leading-tight">
          {greeting(hour)}, {name}.
        </h1>
        <p className="mt-1.5 text-[0.82rem] text-[var(--color-faint)]">
          {fmtLongDate(today, settings.timezone)}
          {hijriDate(today) && <span className="ar"> · {hijriDate(today)}</span>}
          <span className="mx-1.5 text-[var(--color-line)]">·</span>
          {settings.city}
        </p>
      </header>

      {/* ── Next action ──────────────────────────────────────── */}
      <Card className="mb-5 border-l-2" >
        <div className="flex flex-wrap items-start gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] tracking-[0.1em] uppercase" style={{ color: urgencyColor }}>
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

      {/* ── The verdict, as a state and never an average ──────── */}
      <Card className="mb-5">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[1.02rem]">{s.evaluation.headline}</h2>
            {daysSinceGood !== null && daysSinceGood > 0 && (
              <span className="text-[0.75rem] text-[var(--color-faint)]">
                Last day the foundation held: {daysSinceGood === 1 ? "yesterday" : `${daysSinceGood} days ago`}
              </span>
            )}
          </div>
          <p className="mt-1 text-[0.82rem] text-[var(--color-faint)]">{s.evaluation.note}</p>
        </div>

        <div className="grid gap-6 border-t border-[var(--color-line-soft)] px-5 py-5 sm:grid-cols-2">
          <ScoreBlock score={s.foundation} label="Foundation" ar="الأساس" tone="deen" />
          <ScoreBlock score={s.life} label="Life Progress" tone="growth" />
        </div>

        <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
          These two are never averaged. A strong Life Progress score does not repair a weak Foundation —
          that is the whole point of showing them apart.
          {s.isToday && s.elapsed < 5 && (
            <> Foundation is scored out of {s.foundation.max} so far today, rising as each prayer enters.</>
          )}
        </p>
      </Card>

      {/* ── Obligatory prayers ───────────────────────────────── */}
      <Card className="mb-5">
        <CardHead title="The five prayers" ar="الصلوات الخمس"
          sub={`${performed}/5 prayed · ${onTime}/5 on time`} />
        <PrayerStrip
          date={today}
          tz={settings.timezone}
          editable
          rows={s.prayers.map((p) => {
            const w = s.windows.find((x) => x.prayer === p.prayer)!;
            return {
              prayer: p.prayer, status: p.status, jamaah: p.jamaah, mosque: p.mosque,
              manualOverride: p.manualOverride,
              startISO: w.start.toISOString(),
              onTimeUntilISO: w.onTimeUntil.toISOString(),
              endISO: w.end.toISOString(),
              due: s.now >= w.start,
              windowClosed: s.now >= w.end,
            };
          })}
        />
        <div className="flex flex-wrap items-center gap-6 border-t border-[var(--color-line-soft)] px-5 py-3.5">
          <Stat value={`${performed}/5`} label="Prayed" tone={performed === 5 ? "deen" : "text"} />
          <Stat value={`${onTime}/5`} label="On time" tone={onTime >= 3 ? "deen" : onTime > 0 ? "warn" : "faint"} />
          <Stat value={`${jamaah}`} label="In congregation" ar="جماعة" tone="faint" />
          <Stat value={`${mosque}`} label="At the mosque" tone="faint" />
          <p className="ml-auto max-w-xs text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
            On-time window: {settings.onTimeWindowMinutes} min from when each prayer enters.
            Times use Fajr {Number(settings.fajrAngle)}° / Isha {Number(settings.ishaAngle)}°.
          </p>
        </div>
      </Card>

      {/* ── Optional practices, deliberately downstream ───────── */}
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
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] text-[var(--color-faint)]">
            Edit these in the daily check-in. Missing one of these is not the same as missing a Fard prayer,
            and this app will never present it that way.
          </p>
        </Card>
      )}

      {/* ── Deen snapshot + today ────────────────────────────── */}
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHead title="Qur'an" ar="القرآن" />
          <div className="flex flex-wrap gap-7 px-5 py-4">
            <Stat value={s.quran ? `${Number(s.quran.pages)}` : "0"} label="Pages today"
              tone={s.quran && Number(s.quran.pages) > 0 ? "deen" : "faint"} />
            <Stat value={`${quranDays7}/7`} label="Days this week"
              tone={quranDays7 >= 3 ? "deen" : quranDays7 > 0 ? "warn" : "faint"} />
            <Stat value={`${totalPages30}`} label="Pages, 30 days" tone="faint" />
          </div>
          <p className="border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.73rem] leading-relaxed text-[var(--color-faint)]">
            {quranDays7 === 0
              ? "Nothing this week. One page today restarts it — there is no streak to \"deserve\" first."
              : `Goal is ${Number(settings.quranGoalPages)} page${Number(settings.quranGoalPages) === 1 ? "" : "s"} a day. Returning after a gap counts as much as never stopping.`}
          </p>
        </Card>

        <Card>
          <CardHead title="Today" />
          <div className="space-y-3 px-5 py-4 text-[0.82rem]">
            <Line label="Priority" value={s.day.topPriority ?? "Not named"}
              ok={!!s.day.topPriorityDone} dim={!s.day.topPriority} />
            <Line label="Deep work"
              value={s.day.deepWorkMinutes === null ? "Not logged" : `${(s.day.deepWorkMinutes / 60).toFixed(1)}h`}
              ok={(s.day.deepWorkMinutes ?? 0) >= 120} dim={s.day.deepWorkMinutes === null} />
            <Line label="Sleep"
              value={s.sleep?.durationMinutes ? `${(s.sleep.durationMinutes / 60).toFixed(1)}h` : "Not logged"}
              ok={(s.sleep?.durationMinutes ?? 0) >= 360} dim={!s.sleep?.durationMinutes} />
            <Line label="Family" ar="الأهل"
              value={s.day.familyContact ? (s.day.familyNote ?? "Yes") : s.day.familyContact === false ? "Not yet today" : "Not logged"}
              ok={!!s.day.familyContact} dim={s.day.familyContact === null} />
          </div>
        </Card>
      </div>

      {/* ── Patterns: silent until there is real data ─────────── */}
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
        {patterns.ready && patterns.insights.length > 3 && (
          <Link href="/insights"
            className="block border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.78rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
            All patterns →
          </Link>
        )}
      </Card>

      {/* ── Reset: present, never nagging ────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
        <div>
          <p className="text-[0.9rem]">
            {s.evaluation.suggestReset ? "Today slipped. Deal with it today." : "Had a bad day?"}
          </p>
          <p className="mt-0.5 text-[0.78rem] text-[var(--color-faint)]">
            A bad day is allowed. A delayed return is the real danger.
          </p>
        </div>
        <Link href="/reset"
          className={`rounded px-4 py-2 text-[0.8rem] tracking-wide transition-colors ${
            s.evaluation.suggestReset
              ? "bg-[var(--color-deen-dim)] text-[var(--color-text)] hover:bg-[var(--color-deen)]/40"
              : "border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-deen-dim)]"}`}>
          🔄 Reset today
        </Link>
      </div>

      {s.reset && (
        <Card className="mt-5">
          <CardHead title="Today's recovery plan"
            sub={s.reset.completedAt ? "Complete" : `${(s.reset.plan as any[]).filter((p) => p.done).length}/${(s.reset.plan as any[]).length} done`} />
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {(s.reset.plan as any[]).map((p, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-[0.84rem]">
                <span className="h-1.5 w-1.5 rounded-full"
                  style={{ background: p.done ? "var(--color-deen)" : "var(--color-line)" }} />
                <span className={p.done ? "text-[var(--color-faint)] line-through" : ""}>{p.text}</span>
                <span className="ml-auto text-[0.72rem] text-[var(--color-faint)] capitalize">{p.area}</span>
              </li>
            ))}
          </ul>
          <Link href="/reset" className="block border-t border-[var(--color-line-soft)] px-5 py-2.5 text-[0.78rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Open recovery plan →
          </Link>
        </Card>
      )}
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
