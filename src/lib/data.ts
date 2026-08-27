import { eq, and, gte, lte, asc, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import { PRAYERS, windowsFor, deriveStatus, type TimingSettings } from "./prayer-times";
import { todayIn, addDays, weekStart, partsIn, type ISODate } from "./dates";
import { rollUpDay, DEFAULT_SCORING, type ScoringSettings, type DayRollup } from "./scoring";
import { DEFAULT_WEIGHTS, type CategoryKey, type ScoringInputs } from "./categories";

export type Settings = typeof schema.settings.$inferSelect;
export type Day = typeof schema.days.$inferSelect;
export type Prayer = typeof schema.prayers.$inferSelect;

export async function loadSettings(userId: number): Promise<Settings> {
  const db = await getDb();
  const [s] = await db.select().from(schema.settings)
    .where(eq(schema.settings.userId, userId)).limit(1);
  if (s) return s;
  const [created] = await db.insert(schema.settings).values({ userId }).returning();
  return created;
}

/** Weights and gate constants come from the database so they can be
 *  tuned from Settings without a deploy. */
export async function loadScoringSettings(userId: number): Promise<ScoringSettings> {
  const db = await getDb();
  const [rows, cfgRows] = await Promise.all([
    db.select().from(schema.categoryWeights).where(eq(schema.categoryWeights.userId, userId)),
    db.select().from(schema.scoringConfig).where(eq(schema.scoringConfig.userId, userId)).limit(1),
  ]);

  const weights = { ...DEFAULT_WEIGHTS };
  for (const r of rows as any[]) {
    if (r.category in weights) weights[r.category as CategoryKey] = Number(r.weight);
  }
  const cfg = cfgRows[0];
  return {
    weights,
    gateCapOffset: cfg ? Number(cfg.gateCapOffset) : DEFAULT_SCORING.gateCapOffset,
  };
}

export async function loadScoringConfig(userId: number) {
  const db = await getDb();
  const [c] = await db.select().from(schema.scoringConfig)
    .where(eq(schema.scoringConfig.userId, userId)).limit(1);
  if (c) return c;
  const [created] = await db.insert(schema.scoringConfig).values({ userId }).returning();
  return created;
}

export function timingFrom(s: Settings): TimingSettings {
  return {
    latitude: Number(s.latitude), longitude: Number(s.longitude),
    timezone: s.timezone, fajrAngle: Number(s.fajrAngle), ishaAngle: Number(s.ishaAngle),
    madhab: s.madhab, onTimeWindowMinutes: s.onTimeWindowMinutes,
  };
}

export async function ensureDay(userId: number, date: ISODate): Promise<Day> {
  const db = await getDb();
  const [existing] = await db.select().from(schema.days)
    .where(and(eq(schema.days.userId, userId), eq(schema.days.date, date))).limit(1);

  let day = existing;
  if (!day) {
    const [created] = await db.insert(schema.days).values({ userId, date })
      .onConflictDoNothing().returning();
    day = created ?? (await db.select().from(schema.days)
      .where(and(eq(schema.days.userId, userId), eq(schema.days.date, date))).limit(1))[0];
  }

  const rows = await db.select().from(schema.prayers)
    .where(and(eq(schema.prayers.userId, userId), eq(schema.prayers.date, date)));
  const have = new Set(rows.map((r: Prayer) => r.prayer));
  const missing = PRAYERS.filter((p) => !have.has(p));
  if (missing.length) {
    await db.insert(schema.prayers)
      .values(missing.map((p) => ({ userId, date, prayer: p }))).onConflictDoNothing();
  }
  return day;
}

/** Minutes past local midnight, for wake-time consistency. */
function wakeMinutes(at: Date | null, tz: string): number | null {
  if (!at) return null;
  const { hour, minute } = partsIn(tz, at);
  return hour * 60 + minute;
}

/** "HH:MM" -> minutes past midnight. */
export function clockToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Absolute distance in minutes, wrapping the clock so 23:50 and
 *  00:10 are 20 minutes apart rather than 1420. */
export function clockDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type DaySnapshot = Awaited<ReturnType<typeof loadDay>>;

export async function loadDay(userId: number, date: ISODate, now = new Date()) {
  const db = await getDb();
  const settings = await loadSettings(userId);
  const scoring = await loadScoringSettings(userId);
  const cfg = await loadScoringConfig(userId);
  const day = await ensureDay(userId, date);
  const tz = settings.timezone;

  const wkStart = weekStart(date, settings.weeklyReviewWeekday);

  const [
    prayers, quranRows, sleepRows, practiceRows, defs, reflectionRows, resetRows,
    dueCommitments, recentSleep, txToday, activeProjects, bizWeek, bizToday,
  ] = await Promise.all([
    db.select().from(schema.prayers)
      .where(and(eq(schema.prayers.userId, userId), eq(schema.prayers.date, date))),
    db.select().from(schema.quranEntries)
      .where(and(eq(schema.quranEntries.userId, userId), eq(schema.quranEntries.date, date))).limit(1),
    db.select().from(schema.sleepEntries)
      .where(and(eq(schema.sleepEntries.userId, userId), eq(schema.sleepEntries.date, date))).limit(1),
    db.select().from(schema.practices)
      .where(and(eq(schema.practices.userId, userId), eq(schema.practices.date, date))),
    db.select().from(schema.practiceDefs)
      .where(and(eq(schema.practiceDefs.userId, userId), eq(schema.practiceDefs.active, true)))
      .orderBy(asc(schema.practiceDefs.sortOrder)),
    db.select().from(schema.reflections)
      .where(and(eq(schema.reflections.userId, userId), eq(schema.reflections.date, date),
                 eq(schema.reflections.scope, "daily"))).limit(1),
    db.select().from(schema.resets)
      .where(and(eq(schema.resets.userId, userId), eq(schema.resets.date, date)))
      .orderBy(desc(schema.resets.createdAt)).limit(1),
    db.select().from(schema.commitments)
      .where(and(eq(schema.commitments.userId, userId), eq(schema.commitments.dueOn, date))),
    db.select().from(schema.sleepEntries)
      .where(and(eq(schema.sleepEntries.userId, userId),
                 gte(schema.sleepEntries.date, addDays(date, -7)),
                 lte(schema.sleepEntries.date, addDays(date, -1)))),
    db.select().from(schema.financialTransactions)
      .where(and(eq(schema.financialTransactions.userId, userId),
                 eq(schema.financialTransactions.date, date))),
    db.select().from(schema.projects)
      .where(and(eq(schema.projects.userId, userId), eq(schema.projects.status, "active"))),
    db.select().from(schema.businessMetrics)
      .where(and(eq(schema.businessMetrics.userId, userId),
                 gte(schema.businessMetrics.date, wkStart), lte(schema.businessMetrics.date, date))),
    db.select().from(schema.businessMetrics)
      .where(and(eq(schema.businessMetrics.userId, userId), eq(schema.businessMetrics.date, date))),
  ]);

  const timing = timingFrom(settings);
  const windows = windowsFor(date, timing);
  const isToday = date === todayIn(tz, now);
  const elapsed = isToday ? windows.filter((w) => now >= w.start).length : 5;

  const ordered = PRAYERS.map((p) => prayers.find((r: Prayer) => r.prayer === p)!).filter(Boolean);
  const quran = quranRows[0] ?? null;
  const sleep = sleepRows[0] ?? null;
  const reflection = reflectionRows[0] ?? null;

  const performed = ordered.filter((p) => p.status === "on_time" || p.status === "late").length;
  const onTime = ordered.filter((p) => p.status === "on_time").length;

  // Dhikr counts if any dhikr-tagged voluntary practice was done.
  const dhikrKeys = (defs as any[]).filter((d) => d.key.startsWith("dhikr")).map((d) => d.key);
  const dhikrRows = (practiceRows as any[]).filter((p) => dhikrKeys.includes(p.key));
  const dhikrDone = dhikrRows.length ? dhikrRows.some((p) => p.done)
    : (practiceRows as any[]).length ? false : null;

  const kept = (dueCommitments as any[]).filter((c) => c.status === "kept").length;
  const workDue = (dueCommitments as any[]).filter((c) => c.area === "work");
  const workKept = workDue.filter((c) => c.status === "kept").length;

  const wakeToday = wakeMinutes(sleep?.wokeAt ?? null, tz);
  const wakeTarget = clockToMinutes(settings.targetWakeTime);
  const wakeDeviation = wakeToday !== null && wakeTarget !== null
    ? clockDistance(wakeToday, wakeTarget) : null;

  const moneyAction = (txToday as any[]).length
    ? (txToday as any[]).some((t) => t.type === "debt_payment" || t.type === "saving")
    : null;
  // Count of unnecessary purchases, not their total — the formula
  // subtracts per transaction.
  const unnecessaryCount = (txToday as any[]).length
    ? (txToday as any[]).filter((t) => t.isUnnecessary).length
    : day.unnecessarySpend === null ? null : (Number(day.unnecessarySpend) > 0 ? 1 : 0);

  const bizTodayCount = (activeProjects as any[]).length
    ? (bizToday as any[]).reduce((a, r) =>
        a + r.businessesContacted + r.businessesVisited + r.meetings + r.leads + r.followUps, 0)
    : null;
  const weeklyTarget = (activeProjects as any[]).reduce((a, p) => a + p.weeklyTarget, 0);
  const weekCount = (bizWeek as any[]).reduce((a, r) =>
    a + r.businessesContacted + r.businessesVisited + r.meetings + r.leads + r.followUps, 0);
  const bizPace = weeklyTarget > 0 ? weekCount / weeklyTarget : null;

  const inputs: ScoringInputs = {
    finalized: !isToday || day.checkedInAt !== null,
    prayersCompleted: performed, prayersOnTime: onTime,
    prayersInCongregation: ordered.filter((p) => p.jamaah).length,
    elapsedPrayers: elapsed,
    quranPages: quran ? Number(quran.pages) : null,
    quranGoalPages: Number(settings.quranGoalPages),
    dhikrDone, muhasabahDone: !!reflection,
    promisesMade: (dueCommitments as any[]).length,
    promisesKept: kept,
    scheduledEvents: day.scheduledEvents, onTimeEvents: day.onTimeEvents,
    excusesLogged: day.excusesLogged, avoidanceFlags: day.avoidanceFlags,
    mostImportantTaskSet: !!day.topPriority,
    mostImportantTaskDone: day.topPriorityDone,
    deepWorkMinutes: day.deepWorkMinutes,
    deepWorkTargetMinutes: cfg.deepWorkTargetMinutes,
    commitmentsDue: workDue.length, commitmentsMet: workKept,
    sleepMinutes: sleep?.durationMinutes ?? null,
    sleepGoalHours: Number(settings.sleepGoalHours),
    wakeDeviationMinutes: wakeDeviation,
    exerciseDone: day.movement, hygieneDone: day.hygiene,
    interactionLogged: day.familyContact, responsibilityDone: day.familyResponsibility,
    unnecessaryTxns: unnecessaryCount,
    plannedActionTaken: moneyAction,
    learningMinutes: day.learningMinutes,
    hasAppliedNote: day.learningApplied,
    weeklyActivityCount: weekCount, weeklyTarget,
  };

  // A day is "finalized" once you have closed it. Before that, blanks
  // are excluded rather than counted as zero.
  const finalized = !isToday || day.checkedInAt !== null;
  const rollup = rollUpDay(inputs, scoring, finalized);

  return {
    date, settings, scoring, cfg, timing, day, windows, elapsed, isToday, finalized,
    prayers: ordered, quran, sleep, reflection,
    practices: practiceRows, practiceDefs: defs,
    reset: resetRows[0] ?? null,
    dueCommitments, inputs, rollup, now,
    weekStart: wkStart,
  };
}

export async function refreshPrayerStatuses(userId: number, date: ISODate, now = new Date()) {
  const db = await getDb();
  const settings = await loadSettings(userId);
  const windows = windowsFor(date, timingFrom(settings));
  const rows = await db.select().from(schema.prayers)
    .where(and(eq(schema.prayers.userId, userId), eq(schema.prayers.date, date)));

  for (const row of rows as Prayer[]) {
    if (row.manualOverride) continue;
    const w = windows.find((x) => x.prayer === row.prayer)!;
    const derived = deriveStatus(w, row.prayedAt, now);
    const next = derived === "not_yet" ? "not_logged"
      : row.prayedAt ? derived
      : derived === "missed" ? "missed" : "not_logged";
    if (next !== row.status) {
      await db.update(schema.prayers).set({ status: next }).where(eq(schema.prayers.id, row.id));
    }
  }
}

/* ── Facts for trends and pattern detection ── */

export type DayFactFull = {
  date: ISODate;
  checkedIn: boolean;
  categories: Partial<Record<CategoryKey, number | null>>;
  foundationPct: number | null;
  lifePct: number | null;
  overallPct: number | null;
  gated: boolean;
  sleepMinutes: number | null;
  fajrOnTime: boolean | null;
  prayersPerformed: number | null;
  prayersOnTime: number | null;
  deepWorkMinutes: number | null;
  quranPages: number | null;
  familyContact: boolean | null;
  elapsedPrayers: number;
};

export async function loadRange(
  userId: number, from: ISODate, to: ISODate,
): Promise<DayFactFull[]> {
  const db = await getDb();
  const settings = await loadSettings(userId);
  const scoring = await loadScoringSettings(userId);
  const cfg = await loadScoringConfig(userId);
  const tz = settings.timezone;

  const [days, prayers, quran, sleep, reflections, commitments, tx, biz, projects] =
    await Promise.all([
      db.select().from(schema.days).where(and(eq(schema.days.userId, userId),
        gte(schema.days.date, from), lte(schema.days.date, to))).orderBy(asc(schema.days.date)),
      db.select().from(schema.prayers).where(and(eq(schema.prayers.userId, userId),
        gte(schema.prayers.date, from), lte(schema.prayers.date, to))),
      db.select().from(schema.quranEntries).where(and(eq(schema.quranEntries.userId, userId),
        gte(schema.quranEntries.date, from), lte(schema.quranEntries.date, to))),
      db.select().from(schema.sleepEntries).where(and(eq(schema.sleepEntries.userId, userId),
        gte(schema.sleepEntries.date, from), lte(schema.sleepEntries.date, to))),
      db.select().from(schema.reflections).where(and(eq(schema.reflections.userId, userId),
        eq(schema.reflections.scope, "daily"),
        gte(schema.reflections.date, from), lte(schema.reflections.date, to))),
      db.select().from(schema.commitments).where(eq(schema.commitments.userId, userId)),
      db.select().from(schema.financialTransactions).where(and(
        eq(schema.financialTransactions.userId, userId),
        gte(schema.financialTransactions.date, from), lte(schema.financialTransactions.date, to))),
      db.select().from(schema.businessMetrics).where(and(eq(schema.businessMetrics.userId, userId),
        gte(schema.businessMetrics.date, from), lte(schema.businessMetrics.date, to))),
      db.select().from(schema.projects).where(and(eq(schema.projects.userId, userId),
        eq(schema.projects.status, "active"))),
    ]);

  const weeklyTarget = (projects as any[]).reduce((a, p) => a + p.weeklyTarget, 0);
  const out: DayFactFull[] = [];
  const sleepByDate = new Map((sleep as any[]).map((s) => [s.date, s]));

  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = (days as Day[]).find((x) => x.date === d);
    if (!day) {
      out.push({
        date: d, checkedIn: false, categories: {}, foundationPct: null, lifePct: null,
        overallPct: null, gated: false, sleepMinutes: null, fajrOnTime: null,
        prayersPerformed: null, prayersOnTime: null, deepWorkMinutes: null,
        quranPages: null, familyContact: null, elapsedPrayers: 5,
      });
      continue;
    }

    const checkedInFlag = day.checkedInAt !== null;
    const ps = (prayers as Prayer[]).filter((p) => p.date === d);
    const q = (quran as any[]).find((x) => x.date === d);
    const s = sleepByDate.get(d);
    const refl = (reflections as any[]).find((x) => x.date === d);
    const due = (commitments as any[]).filter((c) => c.dueOn === d);
    const workDue = due.filter((c) => c.area === "work");
    const txDay = (tx as any[]).filter((x) => x.date === d);
    const bizDay = (biz as any[]).filter((x) => x.date === d);

    const wk = weekStart(d, settings.weeklyReviewWeekday);
    const bizWeek = (biz as any[]).filter((x) => x.date >= wk && x.date <= d);
    const weekCount = bizWeek.reduce((a, r) =>
      a + r.businessesContacted + r.businessesVisited + r.meetings + r.leads + r.followUps, 0);

    const wakeToday = wakeMinutes(s?.wokeAt ?? null, tz);
    const wakeTarget = clockToMinutes(settings.targetWakeTime);

    const performed = ps.filter((p) => p.status === "on_time" || p.status === "late").length;
    const onTime = ps.filter((p) => p.status === "on_time").length;
    const fajr = ps.find((p) => p.prayer === "fajr");

    const inputs: ScoringInputs = {
      finalized: checkedInFlag,
      prayersCompleted: performed, prayersOnTime: onTime,
      prayersInCongregation: ps.filter((p) => p.jamaah).length,
      elapsedPrayers: 5,
      quranPages: q ? Number(q.pages) : null,
      quranGoalPages: Number(settings.quranGoalPages),
      dhikrDone: null, muhasabahDone: !!refl,
      promisesMade: due.length,
      promisesKept: due.filter((c) => c.status === "kept").length,
      scheduledEvents: day.scheduledEvents, onTimeEvents: day.onTimeEvents,
      excusesLogged: day.excusesLogged, avoidanceFlags: day.avoidanceFlags,
      mostImportantTaskSet: !!day.topPriority,
      mostImportantTaskDone: day.topPriorityDone,
      deepWorkMinutes: day.deepWorkMinutes,
      deepWorkTargetMinutes: cfg.deepWorkTargetMinutes,
      commitmentsDue: workDue.length,
      commitmentsMet: workDue.filter((c) => c.status === "kept").length,
      sleepMinutes: s?.durationMinutes ?? null,
      sleepGoalHours: Number(settings.sleepGoalHours),
      wakeDeviationMinutes: wakeToday !== null && wakeTarget !== null
        ? clockDistance(wakeToday, wakeTarget) : null,
      exerciseDone: day.movement, hygieneDone: day.hygiene,
      interactionLogged: day.familyContact, responsibilityDone: day.familyResponsibility,
      unnecessaryTxns: txDay.length
        ? txDay.filter((t) => t.isUnnecessary).length
        : day.unnecessarySpend === null ? null : (Number(day.unnecessarySpend) > 0 ? 1 : 0),
      plannedActionTaken: txDay.length
        ? txDay.some((t) => t.type === "debt_payment" || t.type === "saving") : null,
      learningMinutes: day.learningMinutes,
      hasAppliedNote: day.learningApplied,
      weeklyActivityCount: weekCount, weeklyTarget,
    };

    const r: DayRollup = rollUpDay(inputs, scoring, checkedInFlag);
    const cats: Partial<Record<CategoryKey, number | null>> = {};
    for (const [k, v] of Object.entries(r.categories)) cats[k as CategoryKey] = v.pct;

    out.push({
      date: d, checkedIn: checkedInFlag, categories: cats,
      foundationPct: r.foundation.pct, lifePct: r.life.pct,
      overallPct: r.overallPct, gated: r.gated,
      sleepMinutes: s?.durationMinutes ?? null,
      fajrOnTime: fajr && fajr.status !== "not_logged" ? fajr.status === "on_time" : null,
      prayersPerformed: performed, prayersOnTime: onTime,
      deepWorkMinutes: day.deepWorkMinutes,
      quranPages: q ? Number(q.pages) : null,
      familyContact: day.familyContact, elapsedPrayers: 5,
    });
  }
  return out;
}

/* ── Recovery plan: 24h expiry, one carry for an unfinished Deen item ── */

export type PendingRecovery = {
  resetId: number;
  items: { area: string; text: string; done: boolean; index: number; carried: boolean }[];
  fromDate: ISODate;
};

export async function pendingRecovery(
  userId: number, today: ISODate,
): Promise<PendingRecovery[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.resets)
    .where(and(eq(schema.resets.userId, userId),
               gte(schema.resets.date, addDays(today, -1)),
               lte(schema.resets.date, today)))
    .orderBy(desc(schema.resets.createdAt));

  const out: PendingRecovery[] = [];
  for (const r of rows as any[]) {
    const plan = (r.plan as any[]) ?? [];
    if (r.date === today) {
      out.push({
        resetId: r.id, fromDate: r.date,
        items: plan.map((p, index) => ({ ...p, index, carried: false })),
      });
    } else {
      // Yesterday's plan has lapsed — except a single unfinished Deen
      // action, which is allowed to carry exactly once.
      const deenIdx = plan.findIndex((p) => p.area === "deen" && !p.done);
      if (deenIdx >= 0 && !r.deenCarried) {
        out.push({
          resetId: r.id, fromDate: r.date,
          items: [{ ...plan[deenIdx], index: deenIdx, carried: true }],
        });
      }
    }
  }
  return out;
}
