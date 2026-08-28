import { eq, and, gte, lte, asc } from "drizzle-orm";
import { getDb, schema } from "../db";
import {
  CATEGORIES, CATEGORY_DEFS, computeCategory,
  type CategoryKey, type CategoryScore, type CategoryInput,
} from "./categories";
import { rollUp, type DayScores } from "./scoring";
import { prayerTier, quantityPoints, tierPoints, TIER_POINTS } from "./tiers";
import { PRAYERS, windowsFor } from "./prayer-times";
import { todayIn, type ISODate } from "./dates";

/* ═══════════════════════════════════════════════════════════════
   Assembling a day's scores.

   Some sub-habits the app already knows and should never ask about
   again: it has the prayer log with times and mosque flags, the
   Qur'an pages, the sleep hours, the deep-work minutes, the
   commitments and the debt payments. Those are derived. Everything
   else is a tap, stored in habitScoreLog.
   ═══════════════════════════════════════════════════════════════ */

export type DayScoreBundle = {
  date: ISODate;
  scores: DayScores;
  prayersCompleted: number;
  elapsedPrayers: number;
  finalized: boolean;
  /** Sub-habits the app filled in itself, so the UI can say so. */
  derivedKeys: Set<string>;
};

export async function buildDayScores(
  userId: number,
  date: ISODate,
  now = new Date(),
): Promise<DayScoreBundle> {
  const db = await getDb();

  const [settingsRows, cfgRows, dayRows, prayerRows, quranRows, sleepRows,
         tierRows, commitmentRows, debtRows, paymentRows] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.userId, userId)).limit(1),
    db.select().from(schema.scoringConfig).where(eq(schema.scoringConfig.userId, userId)).limit(1),
    db.select().from(schema.days).where(and(eq(schema.days.userId, userId), eq(schema.days.date, date))).limit(1),
    db.select().from(schema.prayers).where(and(eq(schema.prayers.userId, userId), eq(schema.prayers.date, date))),
    db.select().from(schema.quranEntries).where(and(eq(schema.quranEntries.userId, userId), eq(schema.quranEntries.date, date))).limit(1),
    db.select().from(schema.sleepEntries).where(and(eq(schema.sleepEntries.userId, userId), eq(schema.sleepEntries.date, date))).limit(1),
    db.select().from(schema.habitScoreLog).where(and(eq(schema.habitScoreLog.userId, userId), eq(schema.habitScoreLog.date, date))),
    db.select().from(schema.commitments).where(and(eq(schema.commitments.userId, userId), eq(schema.commitments.dueOn, date))),
    db.select().from(schema.debts).where(and(eq(schema.debts.userId, userId), eq(schema.debts.status, "open"))),
    db.select().from(schema.financialTransactions).where(and(
      eq(schema.financialTransactions.userId, userId),
      eq(schema.financialTransactions.type, "debt_payment"),
      gte(schema.financialTransactions.date, date.slice(0, 8) + "01"),
      lte(schema.financialTransactions.date, date))),
  ]);

  const settings = settingsRows[0];
  const cfg = cfgRows[0];
  const day = dayRows[0];
  const tz = settings?.timezone ?? "Africa/Casablanca";

  const isToday = date === todayIn(tz, now);
  const finalized = !isToday || (day?.checkedInAt ?? null) !== null;

  const windows = settings ? windowsFor(date, {
    latitude: Number(settings.latitude), longitude: Number(settings.longitude),
    timezone: tz, fajrAngle: Number(settings.fajrAngle), ishaAngle: Number(settings.ishaAngle),
    madhab: settings.madhab, onTimeWindowMinutes: settings.onTimeWindowMinutes,
  }) : [];
  const elapsedPrayers = isToday && windows.length
    ? windows.filter((w) => now >= w.start).length : 5;

  // Tapped entries, keyed by sub-habit.
  const tapped = new Map<string, { points: number; raw: string | null }>();
  for (const r of tierRows as any[]) {
    tapped.set(r.subHabitKey, { points: r.points, raw: r.rawValue });
  }

  const derivedKeys = new Set<string>();
  const points: Record<string, number | null> = {};
  const raw: Record<string, string | null> = {};
  const detail: Record<string, string | undefined> = {};

  /* ── Deen: prayers derived from the prayer log ── */
  let prayersCompleted = 0;
  for (const p of PRAYERS) {
    const row = (prayerRows as any[]).find((r) => r.prayer === p);
    const w = windows.find((x) => x.prayer === p);
    const closed = w ? now >= w.end : true;
    const t = row ? prayerTier(row.status, row.jamaah, row.mosque, closed) : null;
    derivedKeys.add(p);
    points[p] = t ? t.points : null;
    raw[p] = t ? t.key : null;
    detail[p] = t
      ? { missed: "Missed", late: "Late, alone", on_time: "On time, alone",
          congregation: "On time, in congregation", mosque: "On time, at the mosque" }[t.key]
      : (w && now < w.start ? "Not yet due" : "Not logged");
    if (row && (row.status === "on_time" || row.status === "late")) prayersCompleted++;
  }

  const quran = quranRows[0] as any;
  const quranGoal = Number(settings?.quranGoalPages ?? 1);
  derivedKeys.add("quran");
  points.quran = quran ? quantityPoints(Number(quran.pages), quranGoal) : null;
  raw.quran = quran ? String(Number(quran.pages)) : null;
  detail.quran = quran ? `${Number(quran.pages)} of ${quranGoal} pages` : undefined;

  /* ── Health: sleep derived ── */
  const sleep = sleepRows[0] as any;
  const sleepGoal = Number(settings?.sleepGoalHours ?? 7);
  derivedKeys.add("sleep");
  const sleepH = sleep?.durationMinutes != null ? sleep.durationMinutes / 60 : null;
  points.sleep = quantityPoints(sleepH, sleepGoal);
  raw.sleep = sleepH === null ? null : sleepH.toFixed(1);
  detail.sleep = sleepH === null ? undefined : `${sleepH.toFixed(1)}h of ${sleepGoal}h`;

  /* ── Work: deep work and commitments derived ── */
  const dwTarget = (cfg?.deepWorkTargetMinutes ?? 120) / 60;
  const dwH = day?.deepWorkMinutes != null ? day.deepWorkMinutes / 60 : null;
  derivedKeys.add("deep_work");
  points.deep_work = quantityPoints(dwH, dwTarget);
  raw.deep_work = dwH === null ? null : dwH.toFixed(1);
  detail.deep_work = dwH === null ? undefined : `${dwH.toFixed(1)}h of ${dwTarget.toFixed(1)}h`;

  const due = (commitmentRows as any[]).length;
  const met = (commitmentRows as any[]).filter((c) => c.status === "kept").length;
  derivedKeys.add("commitments");
  points.commitments = due > 0 ? quantityPoints(met, due) : null;
  raw.commitments = due > 0 ? `${met}/${due}` : null;
  detail.commitments = due > 0 ? `${met} of ${due} kept` : "None due today";

  /* ── Financial: debt progress is monthly, not daily ── */
  const debt = (debtRows as any[])[0];
  const monthlyTarget = debt?.monthlyTarget ? Number(debt.monthlyTarget) : 0;
  const repaidThisMonth = (paymentRows as any[]).reduce((a, t) => a + Number(t.amount), 0);
  derivedKeys.add("debt_progress");
  points.debt_progress = monthlyTarget > 0
    ? quantityPoints(repaidThisMonth, monthlyTarget) : null;
  raw.debt_progress = monthlyTarget > 0 ? String(repaidThisMonth) : null;
  detail.debt_progress = monthlyTarget > 0
    ? `${repaidThisMonth} of ${monthlyTarget} MAD this month`
    : "No monthly target set";

  /* ── Everything else comes from taps ── */
  for (const k of CATEGORIES) {
    for (const s of CATEGORY_DEFS[k].subs) {
      if (derivedKeys.has(s.key)) continue;
      const t = tapped.get(s.key);
      points[s.key] = t ? t.points : null;
      raw[s.key] = t?.raw ?? null;
    }
  }

  const input: CategoryInput = { points, raw, detail };
  const categories = Object.fromEntries(
    CATEGORIES.map((k) => [
      k,
      computeCategory(k, input, finalized, k === "deen" ? prayersCompleted : undefined),
    ]),
  ) as Record<CategoryKey, CategoryScore>;

  return {
    date,
    scores: rollUp(categories, elapsedPrayers, finalized),
    prayersCompleted, elapsedPrayers, finalized, derivedKeys,
  };
}

/* ── Persisting ────────────────────────────────────────────────
   Written when a sub-habit is logged, so today's numbers are always
   current, and kept as-is afterwards so history stays stable. */

export async function persistScores(userId: number, date: ISODate, bundle: DayScoreBundle) {
  const db = await getDb();
  const { scores } = bundle;

  for (const k of CATEGORIES) {
    const c = scores.categories[k];
    for (const s of c.subs) {
      if (s.points === null) continue;
      await db.insert(schema.habitScoreLog).values({
        userId, date, category: k, subHabitKey: s.key,
        inputType: s.input, rawValue: s.rawValue, points: s.points,
        weight: String(s.weight),
      }).onConflictDoUpdate({
        target: [schema.habitScoreLog.userId, schema.habitScoreLog.date,
                 schema.habitScoreLog.subHabitKey],
        set: { points: s.points, rawValue: s.rawValue, inputType: s.input,
               weight: String(s.weight), loggedAt: new Date() },
      });
    }

    await db.insert(schema.categoryScoreLog).values({
      userId, date, category: k,
      rawPoints: String(c.weightedScore), maxPoints: "20",
      capApplied: c.capApplied, uncappedScore: c.weightedScore,
      finalScore: c.score, status: c.status, breakdown: c.subs,
    }).onConflictDoUpdate({
      target: [schema.categoryScoreLog.userId, schema.categoryScoreLog.date,
               schema.categoryScoreLog.category],
      set: {
        rawPoints: String(c.weightedScore), capApplied: c.capApplied,
        uncappedScore: c.weightedScore, finalScore: c.score,
        status: c.status, breakdown: c.subs, computedAt: new Date(),
      },
    });
  }

  await db.insert(schema.majorScoreLog).values({
    userId, date,
    foundation: scores.majors.foundation.score,
    responsibility: scores.majors.responsibility.score,
    growth: scores.majors.growth.score,
    overallStatus: scores.overallStatus,
  }).onConflictDoUpdate({
    target: [schema.majorScoreLog.userId, schema.majorScoreLog.date],
    set: {
      foundation: scores.majors.foundation.score,
      responsibility: scores.majors.responsibility.score,
      growth: scores.majors.growth.score,
      overallStatus: scores.overallStatus,
      computedAt: new Date(),
    },
  });
}

/** Logged major scores over a range — read from the log, never recomputed. */
export async function loadMajorHistory(userId: number, from: ISODate, to: ISODate) {
  const db = await getDb();
  return db.select().from(schema.majorScoreLog).where(and(
    eq(schema.majorScoreLog.userId, userId),
    gte(schema.majorScoreLog.date, from),
    lte(schema.majorScoreLog.date, to),
  )).orderBy(asc(schema.majorScoreLog.date)) as Promise<any[]>;
}

export { TIER_POINTS, tierPoints };
