import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { getDb, schema } from "../db";
import { PRAYERS, windowsFor, deriveStatus, type TimingSettings } from "./prayer-times";
import { todayIn, addDays, type ISODate } from "./dates";
import { foundationScore, lifeProgressScore, evaluateDay, type DayInput } from "./scoring";
import type { DayFact } from "./patterns";

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

export function timingFrom(s: Settings): TimingSettings {
  return {
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    timezone: s.timezone,
    fajrAngle: Number(s.fajrAngle),
    ishaAngle: Number(s.ishaAngle),
    madhab: s.madhab,
    onTimeWindowMinutes: s.onTimeWindowMinutes,
  };
}

/** A day and its five prayer rows always exist together. Creating
 *  them up front means "not logged" is a real, visible state rather
 *  than an absence the UI has to guess at. */
export async function ensureDay(userId: number, date: ISODate): Promise<Day> {
  const db = await getDb();
  const [existing] = await db.select().from(schema.days)
    .where(and(eq(schema.days.userId, userId), eq(schema.days.date, date))).limit(1);

  let day = existing;
  if (!day) {
    const [created] = await db.insert(schema.days)
      .values({ userId, date })
      .onConflictDoNothing()
      .returning();
    day = created ?? (await db.select().from(schema.days)
      .where(and(eq(schema.days.userId, userId), eq(schema.days.date, date)))
      .limit(1))[0];
  }

  const rows = await db.select().from(schema.prayers)
    .where(and(eq(schema.prayers.userId, userId), eq(schema.prayers.date, date)));
  const have = new Set(rows.map((r: Prayer) => r.prayer));
  const missing = PRAYERS.filter((p) => !have.has(p));
  if (missing.length) {
    await db.insert(schema.prayers)
      .values(missing.map((p) => ({ userId, date, prayer: p })))
      .onConflictDoNothing();
  }
  return day;
}

export type DaySnapshot = Awaited<ReturnType<typeof loadDay>>;

export async function loadDay(userId: number, date: ISODate, now = new Date()) {
  const db = await getDb();
  const settings = await loadSettings(userId);
  const day = await ensureDay(userId, date);

  const [prayers, quranRows, sleepRows, practiceRows, defs, reflectionRows, resetRows] =
    await Promise.all([
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
    ]);

  const timing = timingFrom(settings);
  const windows = windowsFor(date, timing);
  const isToday = date === todayIn(settings.timezone, now);
  const elapsed = isToday
    ? windows.filter((w) => now >= w.start).length
    : 5;

  const ordered = PRAYERS.map((p) => prayers.find((r: Prayer) => r.prayer === p)!)
    .filter(Boolean);

  const quran = quranRows[0] ?? null;
  const sleep = sleepRows[0] ?? null;

  const input: DayInput = {
    prayers: ordered.map((p) => ({ prayer: p.prayer, status: p.status })),
    elapsedPrayers: elapsed,
    quranPages: quran ? Number(quran.pages) : null,
    quranGoalPages: Number(settings.quranGoalPages),
    keptPromises: day.keptPromises,
    wasHonest: day.wasHonest,
    madeExcuses: day.madeExcuses,
    sleepMinutes: sleep?.durationMinutes ?? null,
    sleepGoalHours: Number(settings.sleepGoalHours),
    hygiene: day.hygiene,
    movement: day.movement,
    topPriority: day.topPriority,
    topPriorityDone: day.topPriorityDone,
    deepWorkMinutes: day.deepWorkMinutes,
    valueCreated: day.valueCreated,
    learningMinutes: day.learningMinutes,
    learningApplied: day.learningApplied,
    familyContact: day.familyContact,
    familyResponsibility: day.familyResponsibility,
    unnecessarySpend: day.unnecessarySpend === null ? null : Number(day.unnecessarySpend),
    spendLogged: day.unnecessarySpend !== null,
  };

  const foundation = foundationScore(input);
  const life = lifeProgressScore(input);
  const evaluation = evaluateDay(foundation, life, elapsed);

  return {
    date, settings, timing, day, windows, elapsed, isToday,
    prayers: ordered, quran, sleep,
    practices: practiceRows, practiceDefs: defs,
    reflection: reflectionRows[0] ?? null,
    reset: resetRows[0] ?? null,
    foundation, life, evaluation, now,
  };
}

/** Recompute a prayer's status from its timestamp, unless the user
 *  has explicitly overridden it. */
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
      await db.update(schema.prayers).set({ status: next })
        .where(eq(schema.prayers.id, row.id));
    }
  }
}

/** Facts for the pattern engine and trend charts. */
export async function loadFacts(userId: number, from: ISODate, to: ISODate): Promise<DayFact[]> {
  const db = await getDb();
  const settings = await loadSettings(userId);
  const [days, prayers, quran, sleep] = await Promise.all([
    db.select().from(schema.days).where(and(
      eq(schema.days.userId, userId), gte(schema.days.date, from), lte(schema.days.date, to),
    )).orderBy(asc(schema.days.date)),
    db.select().from(schema.prayers).where(and(
      eq(schema.prayers.userId, userId), gte(schema.prayers.date, from), lte(schema.prayers.date, to),
    )),
    db.select().from(schema.quranEntries).where(and(
      eq(schema.quranEntries.userId, userId), gte(schema.quranEntries.date, from), lte(schema.quranEntries.date, to),
    )),
    db.select().from(schema.sleepEntries).where(and(
      eq(schema.sleepEntries.userId, userId), gte(schema.sleepEntries.date, from), lte(schema.sleepEntries.date, to),
    )),
  ]);

  const byDate = new Map<string, DayFact>();
  const goalPages = Number(settings.quranGoalPages);
  const goalSleep = Number(settings.sleepGoalHours);

  for (const d of days as Day[]) {
    const ps = (prayers as Prayer[]).filter((p) => p.date === d.date);
    const q = (quran as any[]).find((x) => x.date === d.date);
    const s = (sleep as any[]).find((x) => x.date === d.date);
    const performed = ps.filter((p) => p.status === "on_time" || p.status === "late").length;
    const onTime = ps.filter((p) => p.status === "on_time").length;
    const fajr = ps.find((p) => p.prayer === "fajr");

    const input: DayInput = {
      prayers: ps.map((p) => ({ prayer: p.prayer, status: p.status })),
      elapsedPrayers: 5,
      quranPages: q ? Number(q.pages) : null,
      quranGoalPages: goalPages,
      keptPromises: d.keptPromises, wasHonest: d.wasHonest, madeExcuses: d.madeExcuses,
      sleepMinutes: s?.durationMinutes ?? null, sleepGoalHours: goalSleep,
      hygiene: d.hygiene, movement: d.movement,
      topPriority: d.topPriority, topPriorityDone: d.topPriorityDone,
      deepWorkMinutes: d.deepWorkMinutes, valueCreated: d.valueCreated,
      learningMinutes: d.learningMinutes, learningApplied: d.learningApplied,
      familyContact: d.familyContact, familyResponsibility: d.familyResponsibility,
      unnecessarySpend: d.unnecessarySpend === null ? null : Number(d.unnecessarySpend),
      spendLogged: d.unnecessarySpend !== null,
    };
    const f = foundationScore(input);

    byDate.set(d.date, {
      date: d.date,
      sleepMinutes: s?.durationMinutes ?? null,
      fajrOnTime: fajr && fajr.status !== "not_logged" ? fajr.status === "on_time" : null,
      prayersOnTime: ps.length ? onTime : null,
      prayersPerformed: ps.length ? performed : null,
      elapsedPrayers: 5,
      deepWorkMinutes: d.deepWorkMinutes,
      quranPages: q ? Number(q.pages) : null,
      familyContact: d.familyContact,
      checkedIn: d.checkedInAt !== null,
      foundationPct: f.max > 0 ? f.total / f.max : null,
    });
  }

  // Fill absent days so gaps are visible rather than silently skipped.
  const out: DayFact[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(byDate.get(d) ?? {
      date: d, sleepMinutes: null, fajrOnTime: null, prayersOnTime: null,
      prayersPerformed: null, elapsedPrayers: 5, deepWorkMinutes: null,
      quranPages: null, familyContact: null, checkedIn: false, foundationPct: null,
    });
  }
  return out;
}
