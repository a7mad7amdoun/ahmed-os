"use server";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getUserId, createSession, destroySession, hashPasscode, verifyPasscode } from "@/lib/auth";
import { loadSettings, ensureDay, refreshPrayerStatuses, timingFrom } from "@/lib/data";
import { windowsFor, deriveStatus, type PrayerKey } from "@/lib/prayer-times";
import { todayIn, type ISODate } from "@/lib/dates";

async function requireUser(): Promise<number> {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  return uid;
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Tri-state. Forms pair a hidden "no" with the checkbox, so the LAST
 *  value wins: checked -> "yes", unchecked -> "no", field absent -> null.
 *  Unanswered must stay null; it is not the same as answered "no". */
const tri = (fd: FormData, k: string): boolean | null => {
  const all = fd.getAll(k);
  if (!all.length) return null;
  const v = String(all[all.length - 1]);
  return v === "yes" || v === "on" || v === "true";
};

/* ── Account ───────────────────────────────────────────────── */

export type FormState = { error?: string } | null;

export async function setupAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const db = await getDb();
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length) redirect("/login");

  const name = str(fd, "name") ?? "Ahmed";
  const passcode = str(fd, "passcode");
  if (!passcode || passcode.length < 4) return { error: "Passcode must be at least 4 characters." };

  const [user] = await db.insert(schema.users)
    .values({ name, passcodeHash: hashPasscode(passcode) }).returning();
  await db.insert(schema.settings).values({ userId: user.id }).onConflictDoNothing();

  // Optional practices, seeded but fully editable. Kept apart from
  // the five obligatory prayers by design.
  await db.insert(schema.practiceDefs).values([
    { userId: user.id, key: "sunnah_rawatib", label: "Sunnah Rawatib", labelAr: "السنن الرواتب", sortOrder: 1 },
    { userId: user.id, key: "witr", label: "Witr", labelAr: "الوتر", sortOrder: 2 },
    { userId: user.id, key: "dhikr_morning", label: "Morning dhikr", labelAr: "أذكار الصباح", sortOrder: 3 },
    { userId: user.id, key: "dhikr_evening", label: "Evening dhikr", labelAr: "أذكار المساء", sortOrder: 4 },
    { userId: user.id, key: "istighfar", label: "Istighfar", labelAr: "الاستغفار", sortOrder: 5 },
    { userId: user.id, key: "islamic_learning", label: "Islamic learning", labelAr: "طلب العلم", sortOrder: 6 },
  ]).onConflictDoNothing();

  // Scoring weights — seeded, then editable in Settings. Never
  // hardcoded in components.
  await db.insert(schema.categoryWeights).values([
    { userId: user.id, category: "deen", weight: "35" },
    { userId: user.id, category: "discipline", weight: "25" },
    { userId: user.id, category: "health", weight: "15" },
    { userId: user.id, category: "work", weight: "15" },
    { userId: user.id, category: "family", weight: "5" },
    { userId: user.id, category: "financial", weight: "2" },
    { userId: user.id, category: "growth", weight: "2" },
    { userId: user.id, category: "business", weight: "1" },
  ]).onConflictDoNothing();
  await db.insert(schema.scoringConfig).values({ userId: user.id }).onConflictDoNothing();

  // Business is a general module, not a ChnoKain feature. ChnoKain is
  // simply the first row; others get added the same way.
  await db.insert(schema.projects).values({
    userId: user.id, name: "ChnoKain", tier: "C", weeklyTarget: 5,
    role: "Outside operations, local relationships, business outreach",
  }).onConflictDoNothing();

  await createSession(user.id);
  redirect("/");
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).limit(1);
  if (!user) redirect("/setup");
  const passcode = str(fd, "passcode") ?? "";
  if (!verifyPasscode(passcode, user.passcodeHash)) return { error: "Incorrect passcode." };
  // Scoring weights — seeded, then editable in Settings. Never
  // hardcoded in components.
  await db.insert(schema.categoryWeights).values([
    { userId: user.id, category: "deen", weight: "35" },
    { userId: user.id, category: "discipline", weight: "25" },
    { userId: user.id, category: "health", weight: "15" },
    { userId: user.id, category: "work", weight: "15" },
    { userId: user.id, category: "family", weight: "5" },
    { userId: user.id, category: "financial", weight: "2" },
    { userId: user.id, category: "growth", weight: "2" },
    { userId: user.id, category: "business", weight: "1" },
  ]).onConflictDoNothing();
  await db.insert(schema.scoringConfig).values({ userId: user.id }).onConflictDoNothing();

  // Business is a general module, not a ChnoKain feature. ChnoKain is
  // simply the first row; others get added the same way.
  await db.insert(schema.projects).values({
    userId: user.id, name: "ChnoKain", tier: "C", weeklyTarget: 5,
    role: "Outside operations, local relationships, business outreach",
  }).onConflictDoNothing();

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ── Prayers ───────────────────────────────────────────────── */

export type PrayerAction = "prayed_now" | "on_time" | "late" | "missed" | "clear";

export async function logPrayer(date: ISODate, prayer: PrayerKey, action: PrayerAction) {
  const uid = await requireUser();
  const db = await getDb();
  const settings = await loadSettings(uid);
  await ensureDay(uid, date);

  const now = new Date();
  const w = windowsFor(date, timingFrom(settings)).find((x) => x.prayer === prayer)!;

  let patch: Partial<typeof schema.prayers.$inferInsert> = {};
  if (action === "prayed_now") {
    // The honest path: record the timestamp and let the window decide.
    patch = { prayedAt: now, status: deriveStatus(w, now, now) as any, manualOverride: false };
  } else if (action === "clear") {
    patch = { prayedAt: null, status: "not_logged", manualOverride: false, jamaah: false, mosque: false };
  } else {
    // Logged after the fact — the user's word, flagged as such.
    patch = { status: action, manualOverride: true, prayedAt: action === "missed" ? null : (undefined as any) };
    if (action === "missed") patch.jamaah = false, patch.mosque = false;
  }

  await db.update(schema.prayers).set(patch).where(and(
    eq(schema.prayers.userId, uid), eq(schema.prayers.date, date), eq(schema.prayers.prayer, prayer),
  ));
  revalidatePath("/"); revalidatePath("/check-in");
}

export async function togglePrayerFlag(date: ISODate, prayer: PrayerKey, flag: "jamaah" | "mosque") {
  const uid = await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(schema.prayers).where(and(
    eq(schema.prayers.userId, uid), eq(schema.prayers.date, date), eq(schema.prayers.prayer, prayer),
  )).limit(1);
  if (!row) return;
  const next = !row[flag];
  // Praying at the mosque implies congregation; keep the data coherent.
  const patch: any = { [flag]: next };
  if (flag === "mosque" && next) patch.jamaah = true;
  if (flag === "jamaah" && !next) patch.mosque = false;
  await db.update(schema.prayers).set(patch).where(eq(schema.prayers.id, row.id));
  revalidatePath("/"); revalidatePath("/check-in");
}

export async function refreshToday() {
  const uid = await requireUser();
  const s = await loadSettings(uid);
  const today = todayIn(s.timezone);
  await refreshPrayerStatuses(uid, today);
  revalidatePath("/");
}

/* ── Daily check-in ────────────────────────────────────────── */

export async function saveCheckIn(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const date = (str(fd, "date") ?? todayIn((await loadSettings(uid)).timezone)) as ISODate;
  await ensureDay(uid, date);

  const dwH = num(fd, "deepWorkHours");
  const wH = num(fd, "workHours");

  await db.update(schema.days).set({
    energy: num(fd, "energy"),
    topPriority: str(fd, "topPriority"),
    topPriorityDone: tri(fd, "topPriorityDone"),
    deepWorkMinutes: dwH === null ? null : Math.round(dwH * 60),
    workMinutes: wH === null ? null : Math.round(wH * 60),
    valueCreated: str(fd, "valueCreated"),
    avoidedTask: str(fd, "avoidedTask"),
    keptPromises: tri(fd, "keptPromises"),
    wasHonest: tri(fd, "wasHonest"),
    madeExcuses: tri(fd, "madeExcuses"),
    excusesLogged: num(fd, "excusesLogged"),
    avoidanceFlags: num(fd, "avoidanceFlags"),
    scheduledEvents: num(fd, "scheduledEvents"),
    onTimeEvents: num(fd, "onTimeEvents"),
    familyContact: tri(fd, "familyContact"),
    familyResponsibility: tri(fd, "familyResponsibility"),
    familyNote: str(fd, "familyNote"),
    movement: tri(fd, "movement"),
    hygiene: tri(fd, "hygiene"),
    learningMinutes: num(fd, "learningMinutes"),
    learningApplied: tri(fd, "learningApplied"),
    // Empty means "not logged", not "spent nothing".
    unnecessarySpend: num(fd, "unnecessarySpend") === null
      ? null : String(num(fd, "unnecessarySpend")),
    checkedInAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(schema.days.userId, uid), eq(schema.days.date, date)));

  // Qur'an
  const pages = num(fd, "quranPages");
  if (pages !== null || str(fd, "quranReflection")) {
    await db.insert(schema.quranEntries).values({
      userId: uid, date, pages: String(pages ?? 0),
      surah: str(fd, "quranSurah"),
      reflection: str(fd, "quranReflection"),
      memorization: str(fd, "quranMemorization"),
    }).onConflictDoUpdate({
      target: [schema.quranEntries.userId, schema.quranEntries.date],
      set: {
        pages: String(pages ?? 0), surah: str(fd, "quranSurah"),
        reflection: str(fd, "quranReflection"), memorization: str(fd, "quranMemorization"),
      },
    });
  }

  // Sleep — stored as clock times, duration derived.
  const sleptAt = str(fd, "sleptAt"), wokeAt = str(fd, "wokeAt");
  if (sleptAt || wokeAt) {
    const parse = (t: string | null, dayOffset: number) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      const [y, mo, d] = date.split("-").map(Number);
      return new Date(Date.UTC(y, mo - 1, d + dayOffset, h, m));
    };
    // Bedtime after 18:00 belongs to the previous calendar day.
    const sh = sleptAt ? Number(sleptAt.split(":")[0]) : 0;
    const s = parse(sleptAt, sh >= 18 ? -1 : 0);
    const w = parse(wokeAt, 0);
    const dur = s && w ? Math.round((w.getTime() - s.getTime()) / 60000) : null;
    await db.insert(schema.sleepEntries).values({
      userId: uid, date, sleptAt: s, wokeAt: w,
      durationMinutes: dur !== null && dur > 0 && dur < 20 * 60 ? dur : null,
      quality: num(fd, "sleepQuality"),
    }).onConflictDoUpdate({
      target: [schema.sleepEntries.userId, schema.sleepEntries.date],
      set: {
        sleptAt: s, wokeAt: w,
        durationMinutes: dur !== null && dur > 0 && dur < 20 * 60 ? dur : null,
        quality: num(fd, "sleepQuality"),
      },
    });
  }

  revalidatePath("/"); revalidatePath("/check-in");
  redirect("/");
}

export async function togglePractice(date: ISODate, key: string) {
  const uid = await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(schema.practices).where(and(
    eq(schema.practices.userId, uid), eq(schema.practices.date, date), eq(schema.practices.key, key),
  )).limit(1);
  if (row) {
    await db.update(schema.practices).set({ done: !row.done }).where(eq(schema.practices.id, row.id));
  } else {
    await db.insert(schema.practices).values({ userId: uid, date, key, done: true });
  }
  revalidatePath("/"); revalidatePath("/check-in");
}

/* ── Muhasabah ─────────────────────────────────────────────── */

export async function saveReflection(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  const date = (str(fd, "date") ?? todayIn(s.timezone)) as ISODate;

  const answers: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("q_") && typeof v === "string" && v.trim()) {
      answers[k.slice(2)] = v.trim();
    }
  }
  await db.insert(schema.reflections)
    .values({ userId: uid, date, scope: "daily", answers })
    .onConflictDoUpdate({
      target: [schema.reflections.userId, schema.reflections.date, schema.reflections.scope],
      set: { answers },
    });
  revalidatePath("/muhasabah"); revalidatePath("/");
  redirect("/");
}

/* ── Reset Protocol ────────────────────────────────────────── */

export async function createReset(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  const date = (str(fd, "date") ?? todayIn(s.timezone)) as ISODate;

  // Deliberately capped at four. Rebuilding the whole life tonight
  // is the failure mode, not the goal.
  const plan = ["deen", "responsibility", "health", "environment"]
    .map((area) => ({ area, text: str(fd, `plan_${area}`) ?? "", done: false }))
    .filter((p) => p.text !== "");

  const [reset] = await db.insert(schema.resets).values({
    userId: uid, date,
    trigger: str(fd, "trigger") ?? "manual",
    whatHappened: str(fd, "whatHappened"),
    realCause: str(fd, "realCause"),
    canControl: str(fd, "canControl"),
    smallestAction: str(fd, "smallestAction"),
    plan,
  }).returning();

  // A reset makes promises. They are recorded so Friday can ask about them.
  if (plan.length) {
    await db.insert(schema.commitments).values(plan.map((p) => ({
      userId: uid, text: p.text, madeOn: date, dueOn: date,
      area: p.area, sourceReset: reset.id,
    })));
  }
  revalidatePath("/"); revalidatePath("/reset");
  redirect("/");
}

export async function toggleResetItem(resetId: number, index: number) {
  const uid = await requireUser();
  const db = await getDb();
  const [reset] = await db.select().from(schema.resets)
    .where(and(eq(schema.resets.id, resetId), eq(schema.resets.userId, uid))).limit(1);
  if (!reset) return;
  const plan = [...(reset.plan as any[])];
  if (!plan[index]) return;
  plan[index] = { ...plan[index], done: !plan[index].done };
  const allDone = plan.every((p) => p.done);
  await db.update(schema.resets)
    .set({ plan, completedAt: allDone ? new Date() : null })
    .where(eq(schema.resets.id, resetId));
  revalidatePath("/"); revalidatePath("/reset");
}

/* ── Settings ──────────────────────────────────────────────── */

export async function saveSettings(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  await db.update(schema.settings).set({
    city: str(fd, "city") ?? "Tetouan",
    latitude: String(num(fd, "latitude") ?? 35.5785),
    longitude: String(num(fd, "longitude") ?? -5.3684),
    timezone: str(fd, "timezone") ?? "Africa/Casablanca",
    fajrAngle: String(num(fd, "fajrAngle") ?? 19),
    ishaAngle: String(num(fd, "ishaAngle") ?? 17),
    madhab: str(fd, "madhab") ?? "Shafi",
    onTimeWindowMinutes: num(fd, "onTimeWindowMinutes") ?? 30,
    quranGoalPages: String(num(fd, "quranGoalPages") ?? 1),
    sleepGoalHours: String(num(fd, "sleepGoalHours") ?? 7),
    targetWakeTime: str(fd, "targetWakeTime") ?? "06:00",
  }).where(eq(schema.settings.userId, uid));
  revalidatePath("/"); revalidatePath("/settings");
  redirect("/settings?saved=1");
}

/* ═══════════════════════════════════════════════════════════════
   Phase 1 — commitments, money, business, weekly review, weights
   ═══════════════════════════════════════════════════════════════ */

export async function addCommitment(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  const today = todayIn(s.timezone);
  const text = str(fd, "text");
  if (!text) return;
  await db.insert(schema.commitments).values({
    userId: uid, text,
    madeOn: today,
    dueOn: str(fd, "dueOn") ?? today,
    area: str(fd, "area") ?? "deen",
  });
  revalidatePath("/commitments"); revalidatePath("/");
}

export async function setCommitmentStatus(id: number, status: "kept" | "broken" | "open" | "dropped") {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  await db.update(schema.commitments)
    .set({ status, closedOn: status === "open" ? null : todayIn(s.timezone) })
    .where(and(eq(schema.commitments.id, id), eq(schema.commitments.userId, uid)));
  revalidatePath("/commitments"); revalidatePath("/"); revalidatePath("/weekly");
}

export async function addGoal(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const title = str(fd, "title");
  if (!title) return;
  await db.insert(schema.goals).values({
    userId: uid, title,
    category: str(fd, "category") ?? "deen",
    targetDate: str(fd, "targetDate"),
    notes: str(fd, "notes"),
  });
  revalidatePath("/commitments");
}

export async function setGoalStatus(id: number, status: "open" | "achieved" | "abandoned") {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  await db.update(schema.goals)
    .set({ status, closedOn: status === "open" ? null : todayIn(s.timezone) })
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, uid)));
  revalidatePath("/commitments");
}

/* ── Money ── */

export async function addTransaction(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  const amount = num(fd, "amount");
  if (amount === null || amount <= 0) return;
  await db.insert(schema.financialTransactions).values({
    userId: uid,
    date: str(fd, "date") ?? todayIn(s.timezone),
    type: str(fd, "type") ?? "expense",
    category: str(fd, "category") ?? "personal",
    amount: String(amount),
    isUnnecessary: tri(fd, "isUnnecessary") === true,
    debtId: num(fd, "debtId"),
    notes: str(fd, "notes"),
  });
  revalidatePath("/finances"); revalidatePath("/");
}

export async function deleteTransaction(id: number) {
  const uid = await requireUser();
  const db = await getDb();
  await db.delete(schema.financialTransactions).where(and(
    eq(schema.financialTransactions.id, id), eq(schema.financialTransactions.userId, uid)));
  revalidatePath("/finances");
}

export async function saveDebt(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const id = num(fd, "id");
  const total = num(fd, "totalAmount");
  if (total === null) return;
  const values = {
    name: str(fd, "name") ?? "Debt",
    totalAmount: String(total),
    monthlyTarget: num(fd, "monthlyTarget") === null ? null : String(num(fd, "monthlyTarget")),
    notes: str(fd, "notes"),
  };
  if (id) {
    await db.update(schema.debts).set(values)
      .where(and(eq(schema.debts.id, id), eq(schema.debts.userId, uid)));
  } else {
    await db.insert(schema.debts).values({ userId: uid, ...values });
  }
  revalidatePath("/finances");
}

export async function addSavingsGoal(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const target = num(fd, "targetAmount");
  if (target === null) return;
  await db.insert(schema.savingsGoals).values({
    userId: uid, name: str(fd, "name") ?? "Savings", targetAmount: String(target),
  });
  revalidatePath("/finances");
}

/* ── Business / projects ── */

export async function addProject(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const name = str(fd, "name");
  if (!name) return;
  await db.insert(schema.projects).values({
    userId: uid, name,
    tier: str(fd, "tier") ?? "C",
    role: str(fd, "role"),
    weeklyTarget: num(fd, "weeklyTarget") ?? 3,
  });
  revalidatePath("/business"); revalidatePath("/");
}

export async function logBusinessActivity(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const s = await loadSettings(uid);
  const projectId = num(fd, "projectId");
  if (!projectId) return;
  await db.insert(schema.businessMetrics).values({
    userId: uid, projectId,
    date: str(fd, "date") ?? todayIn(s.timezone),
    businessesContacted: num(fd, "businessesContacted") ?? 0,
    businessesVisited: num(fd, "businessesVisited") ?? 0,
    meetings: num(fd, "meetings") ?? 0,
    leads: num(fd, "leads") ?? 0,
    followUps: num(fd, "followUps") ?? 0,
    revenue: num(fd, "revenue") === null ? null : String(num(fd, "revenue")),
    notes: str(fd, "notes"),
  });
  revalidatePath("/business"); revalidatePath("/");
}

/* ── Weekly review ── */

export async function saveWeeklyReview(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const weekStartDate = str(fd, "weekStart");
  if (!weekStartDate) return;

  const answers: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("q_") && typeof v === "string" && v.trim()) answers[k.slice(2)] = v.trim();
  }
  await db.insert(schema.weeklyReviews)
    .values({
      userId: uid, weekStart: weekStartDate, answers,
      biggestPriority: str(fd, "biggestPriority"),
    })
    .onConflictDoUpdate({
      target: [schema.weeklyReviews.userId, schema.weeklyReviews.weekStart],
      set: { answers, biggestPriority: str(fd, "biggestPriority") },
    });
  revalidatePath("/weekly"); revalidatePath("/");
  redirect("/weekly?saved=1");
}

/* ── Scoring configuration ── */

export async function saveWeights(fd: FormData) {
  const uid = await requireUser();
  const db = await getDb();
  const cats = ["deen", "discipline", "health", "work", "family", "financial", "growth", "business"];
  for (const c of cats) {
    const w = num(fd, `w_${c}`);
    if (w === null || w < 0) continue;
    await db.insert(schema.categoryWeights)
      .values({ userId: uid, category: c, weight: String(w) })
      .onConflictDoUpdate({
        target: [schema.categoryWeights.userId, schema.categoryWeights.category],
        set: { weight: String(w), updatedAt: new Date() },
      });
  }
  await db.insert(schema.scoringConfig).values({
    userId: uid,
    gateCapOffset: String(num(fd, "gateCapOffset") ?? 15),
    deepWorkTargetMinutes: Math.round((num(fd, "deepWorkTargetHours") ?? 2) * 60),
    learningTargetMinutes: num(fd, "learningTargetMinutes") ?? 30,
    resetThresholdPct: String(num(fd, "resetThresholdPct") ?? 40),
  }).onConflictDoUpdate({
    target: schema.scoringConfig.userId,
    set: {
        gateCapOffset: String(num(fd, "gateCapOffset") ?? 15),
      deepWorkTargetMinutes: Math.round((num(fd, "deepWorkTargetHours") ?? 2) * 60),
      learningTargetMinutes: num(fd, "learningTargetMinutes") ?? 30,
      resetThresholdPct: String(num(fd, "resetThresholdPct") ?? 40),
    },
  });
  revalidatePath("/settings"); revalidatePath("/");
  redirect("/settings?saved=1");
}
