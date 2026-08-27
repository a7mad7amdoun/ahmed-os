/* ═══════════════════════════════════════════════════════════════
   Category scoring — eight independent 0–100% scores per day.

   Sub-weights and formulas are exactly as specified in §3.1. Each
   category is a pure function of its inputs, unit-testable alone,
   and every sub-metric reports the raw figure behind it so nothing
   is a number you cannot drill into.

   Two kinds of "no value" are distinguished, because conflating
   them is how a score quietly lies:
     · not applicable — structurally absent (no promises were due).
       Skipped, and the remaining sub-weights renormalise.
     · unlogged — applicable but blank. Skipped while the day is
       still running, counted as zero once the day is closed.
   ═══════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
  "deen", "discipline", "health", "work", "family", "financial", "growth", "business",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export const FOUNDATION_CATEGORIES: CategoryKey[] = ["deen", "discipline", "health"];
export const LIFE_CATEGORIES: CategoryKey[] = ["work", "family", "financial", "growth", "business"];

export const CATEGORY_LABELS: Record<CategoryKey, { en: string; ar?: string; icon: string }> = {
  deen:       { en: "Deen", ar: "الدين", icon: "🕌" },
  discipline: { en: "Discipline", icon: "🧠" },
  health:     { en: "Health", icon: "💪" },
  work:       { en: "Work", icon: "💼" },
  family:     { en: "Family", ar: "الأهل", icon: "❤️" },
  financial:  { en: "Financial", icon: "💰" },
  growth:     { en: "Growth", icon: "📚" },
  business:   { en: "Business", icon: "🤝" },
};

export const DEFAULT_WEIGHTS: Record<CategoryKey, number> = {
  deen: 35, discipline: 25, health: 15,
  work: 15, family: 5, financial: 2, growth: 2, business: 1,
};

export type SubMetric = {
  key: string;
  label: string;
  /** 0..1. Null means applicable but unlogged. */
  value: number | null;
  /** Sub-weight within the category, per §3.1. Sums to 100. */
  weight: number;
  /** False when the metric structurally does not apply today. */
  applicable: boolean;
  obligatory?: boolean;
  detail: string;
};

export type CategoryResult = {
  key: CategoryKey;
  label: string;
  ar?: string;
  icon: string;
  pct: number | null;
  subs: SubMetric[];
};

export type ScoringInputs = {
  finalized: boolean;
  // Deen
  prayersCompleted: number;
  prayersOnTime: number;
  prayersInCongregation: number;
  elapsedPrayers: number;
  quranPages: number | null;
  quranGoalPages: number;
  dhikrDone: boolean | null;
  muhasabahDone: boolean;
  // Discipline
  promisesMade: number;
  promisesKept: number;
  scheduledEvents: number | null;
  onTimeEvents: number | null;
  excusesLogged: number | null;
  avoidanceFlags: number | null;
  // Work
  mostImportantTaskSet: boolean;
  mostImportantTaskDone: boolean | null;
  deepWorkMinutes: number | null;
  deepWorkTargetMinutes: number;
  commitmentsDue: number;
  commitmentsMet: number;
  // Health
  sleepMinutes: number | null;
  sleepGoalHours: number;
  wakeDeviationMinutes: number | null;
  exerciseDone: boolean | null;
  hygieneDone: boolean | null;
  // Family
  interactionLogged: boolean | null;
  responsibilityDone: boolean | null;
  // Financial
  unnecessaryTxns: number | null;
  plannedActionTaken: boolean | null;
  // Growth
  learningMinutes: number | null;
  hasAppliedNote: boolean | null;
  // Business
  weeklyActivityCount: number | null;
  weeklyTarget: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r2 = (n: number) => Math.round(n * 100) / 100;
const bool = (b: boolean | null) => (b === null ? null : b ? 1 : 0);

/** Weighted mean over the sub-metrics that count today.
 *  Skipped metrics renormalise the rest — that renormalisation is
 *  *within* a category only. Between categories the roll-up uses the
 *  global weights untouched. */
function rollup(subs: SubMetric[], finalized: boolean): number | null {
  const live = subs.filter((s) => s.applicable && (s.value !== null || finalized));
  if (!live.length) return null;
  const wsum = live.reduce((a, s) => a + s.weight, 0);
  if (wsum === 0) return null;
  const v = live.reduce((a, s) => a + (s.value ?? 0) * s.weight, 0) / wsum;
  return r2(clamp01(v) * 100);
}

function cat(key: CategoryKey, subs: SubMetric[], finalized: boolean): CategoryResult {
  const L = CATEGORY_LABELS[key];
  return { key, label: L.en, ar: L.ar, icon: L.icon, pct: rollup(subs, finalized), subs };
}

/* ── 🕌 Deen — 30 / 25 / 10 / 20 / 15 ─────────────────────────── */
export function deenCategory(i: ScoringInputs): CategoryResult {
  // The spec divides by 5. Taken literally that scores a morning as a
  // failure for prayers that have not yet come, so while the day is
  // still running the divisor is the prayers actually due.
  const denom = i.finalized ? 5 : Math.max(0, Math.min(5, i.elapsedPrayers));
  const pages = i.quranPages;
  const dhikr = bool(i.dhikrDone);

  return cat("deen", [
    {
      key: "prayers_completed", label: "Prayers completed", weight: 30,
      applicable: denom > 0, obligatory: true,
      value: denom > 0 ? i.prayersCompleted / denom : null,
      detail: denom === 0 ? "No prayer has entered yet" : `${i.prayersCompleted} of ${denom} prayed`,
    },
    {
      key: "prayers_on_time", label: "Prayers on time", weight: 25,
      applicable: denom > 0, obligatory: true,
      value: denom > 0 ? i.prayersOnTime / denom : null,
      detail: denom === 0 ? "—" : `${i.prayersOnTime} of ${denom} within the window`,
    },
    {
      key: "congregation", label: "Congregation / mosque", weight: 10,
      applicable: denom > 0,
      value: denom > 0 ? i.prayersInCongregation / denom : null,
      detail: denom === 0 ? "—" : `${i.prayersInCongregation} of ${denom} in jamā'ah`,
    },
    {
      key: "quran", label: "Qur'an habit", weight: 20, applicable: true,
      value: pages === null ? null : clamp01(pages / i.quranGoalPages),
      detail: pages === null ? "Not logged"
        : pages <= 0 ? "Not opened today"
        : `${pages} of ${i.quranGoalPages} page${i.quranGoalPages === 1 ? "" : "s"}`,
    },
    {
      key: "dhikr_muhasabah", label: "Dhikr & Muhasabah", weight: 15, applicable: true,
      // Completion only. No scoring code ever reads reflection content.
      value: dhikr === null && !i.muhasabahDone ? null
        : ((dhikr ?? 0) + (i.muhasabahDone ? 1 : 0)) / 2,
      detail: `${dhikr ? "dhikr" : "no dhikr"}, ${i.muhasabahDone ? "muhasabah written" : "no muhasabah"}`,
    },
  ], i.finalized);
}

/* ── 🧠 Discipline — 40 / 25 / 20 / 15 ────────────────────────── */
export function disciplineCategory(i: ScoringInputs): CategoryResult {
  const ex = i.excusesLogged;
  const av = i.avoidanceFlags;
  return cat("discipline", [
    {
      key: "promises", label: "Promises kept", weight: 40,
      // Skipped entirely when none were due, rather than scored zero.
      applicable: i.promisesMade > 0,
      value: i.promisesMade > 0 ? i.promisesKept / i.promisesMade : null,
      detail: i.promisesMade === 0 ? "None due today"
        : `${i.promisesKept} of ${i.promisesMade} kept`,
    },
    {
      key: "punctuality", label: "Punctuality", weight: 25,
      applicable: (i.scheduledEvents ?? 0) > 0,
      value: i.scheduledEvents && i.scheduledEvents > 0
        ? (i.onTimeEvents ?? 0) / i.scheduledEvents : null,
      detail: !i.scheduledEvents ? "Nothing scheduled"
        : `${i.onTimeEvents ?? 0} of ${i.scheduledEvents} on time`,
    },
    {
      key: "excuse_free", label: "Excuse-free", weight: 20, applicable: true,
      value: ex === null ? null : clamp01((100 - ex * 20) / 100),
      detail: ex === null ? "Not logged" : ex === 0 ? "None" : `${ex} logged`,
    },
    {
      key: "procrastination_free", label: "Procrastination-free", weight: 15, applicable: true,
      value: av === null ? null : clamp01((100 - av * 25) / 100),
      detail: av === null ? "Not logged" : av === 0 ? "Nothing avoided" : `${av} avoided`,
    },
  ], i.finalized);
}

/* ── 💼 Work — 40 / 30 / 30. Hours are not a sub-metric. ──────── */
export function workCategory(i: ScoringInputs): CategoryResult {
  const dw = i.deepWorkMinutes;
  return cat("work", [
    {
      key: "most_important", label: "Most important task done", weight: 40,
      applicable: i.mostImportantTaskSet,
      value: i.mostImportantTaskSet ? (i.mostImportantTaskDone ? 1 : 0) : null,
      detail: !i.mostImportantTaskSet ? "None named"
        : i.mostImportantTaskDone ? "Completed" : "Not completed",
    },
    {
      key: "deep_work", label: "Deep work vs target", weight: 30, applicable: true,
      value: dw === null ? null : clamp01(dw / i.deepWorkTargetMinutes),
      detail: dw === null ? "Not logged"
        : `${(dw / 60).toFixed(1)}h of ${(i.deepWorkTargetMinutes / 60).toFixed(1)}h`,
    },
    {
      key: "commitments", label: "Commitments met", weight: 30,
      applicable: i.commitmentsDue > 0,
      value: i.commitmentsDue > 0 ? i.commitmentsMet / i.commitmentsDue : null,
      detail: i.commitmentsDue === 0 ? "None due" : `${i.commitmentsMet} of ${i.commitmentsDue}`,
    },
  ], i.finalized);
}

/* ── 💪 Health — 35 / 15 / 25 / 25 ────────────────────────────── */
export function healthCategory(i: ScoringInputs): CategoryResult {
  const h = i.sleepMinutes === null ? null : i.sleepMinutes / 60;
  const dev = i.wakeDeviationMinutes;
  return cat("health", [
    {
      key: "sleep", label: "Sleep adequacy", weight: 35, applicable: true,
      // Capped: more sleep is not a higher score.
      value: h === null ? null : clamp01(h / i.sleepGoalHours),
      detail: h === null ? "Not logged" : `${h.toFixed(1)}h of ${i.sleepGoalHours}h`,
    },
    {
      key: "wake_consistency", label: "Wake consistency", weight: 15,
      applicable: true,
      // Full marks within ±30 min of target, then linear decay to zero
      // at two hours out.
      value: dev === null ? null : dev <= 30 ? 1 : clamp01(1 - (dev - 30) / 90),
      detail: dev === null ? "Not logged"
        : dev <= 30 ? `within ${Math.round(dev)} min of target`
        : `${Math.round(dev)} min from target`,
    },
    {
      key: "movement", label: "Movement", weight: 25, applicable: true,
      value: bool(i.exerciseDone),
      detail: i.exerciseDone === null ? "Not logged" : i.exerciseDone ? "Moved" : "None",
    },
    {
      key: "hygiene", label: "Hygiene", weight: 25, applicable: true,
      value: bool(i.hygieneDone),
      detail: i.hygieneDone === null ? "Not logged" : i.hygieneDone ? "Yes" : "No",
    },
  ], i.finalized);
}

/* ── ❤️ Family — 60 / 40 ──────────────────────────────────────── */
export function familyCategory(i: ScoringInputs): CategoryResult {
  return cat("family", [
    {
      key: "interaction", label: "Meaningful interaction", weight: 60, applicable: true,
      value: bool(i.interactionLogged),
      detail: i.interactionLogged === null ? "Not logged"
        : i.interactionLogged ? "Yes" : "None today",
    },
    {
      key: "responsibility", label: "Responsibility fulfilled", weight: 40, applicable: true,
      value: bool(i.responsibilityDone),
      detail: i.responsibilityDone === null ? "Not logged"
        : i.responsibilityDone ? "Yes" : "No",
    },
  ], i.finalized);
}

/* ── 💰 Financial — 50 / 50 ───────────────────────────────────── */
export function financialCategory(i: ScoringInputs): CategoryResult {
  const n = i.unnecessaryTxns;
  return cat("financial", [
    {
      key: "no_unnecessary", label: "No unnecessary spending", weight: 50, applicable: true,
      value: n === null ? null : clamp01((100 - n * 20) / 100),
      detail: n === null ? "Not logged"
        : n === 0 ? "Nothing wasted" : `${n} unnecessary purchase${n === 1 ? "" : "s"}`,
    },
    {
      key: "planned_action", label: "Planned money action", weight: 50, applicable: true,
      value: bool(i.plannedActionTaken),
      detail: i.plannedActionTaken === null ? "Not logged"
        : i.plannedActionTaken ? "Repayment, saving or budgeting step taken" : "None today",
    },
  ], i.finalized);
}

/* ── 📚 Growth — 40 / 60. Unapplied learning caps at 40%. ─────── */
export function growthCategory(i: ScoringInputs): CategoryResult {
  const m = i.learningMinutes;
  return cat("growth", [
    {
      key: "session", label: "Session logged", weight: 40, applicable: true,
      value: m === null ? null : m > 0 ? 1 : 0,
      detail: m === null ? "Not logged" : m > 0 ? `${m} min` : "None",
    },
    {
      // Weighted above the session itself: the whole guard against
      // learning as a way of avoiding the difficult work.
      key: "applied", label: "Applied in practice", weight: 60, applicable: true,
      value: m === null ? null : i.hasAppliedNote ? 1 : 0,
      detail: m === null ? "Not logged"
        : i.hasAppliedNote ? "Used it on something real"
        : "Learned, not applied — caps this category at 40%",
    },
  ], i.finalized);
}

/* ── 🤝 Business — single metric against a weekly target ──────── */
export function businessCategory(i: ScoringInputs): CategoryResult {
  const n = i.weeklyActivityCount;
  return cat("business", [
    {
      key: "weekly_activity", label: "Activity vs weekly target", weight: 100,
      applicable: i.weeklyTarget > 0,
      value: n === null || i.weeklyTarget <= 0 ? null : clamp01(n / i.weeklyTarget),
      detail: i.weeklyTarget <= 0 ? "No active project"
        : n === null ? "Not logged" : `${n} of ${i.weeklyTarget} this week`,
    },
  ], i.finalized);
}

const BUILDERS: Record<CategoryKey, (i: ScoringInputs) => CategoryResult> = {
  deen: deenCategory, discipline: disciplineCategory, health: healthCategory,
  work: workCategory, family: familyCategory, financial: financialCategory,
  growth: growthCategory, business: businessCategory,
};

/** The §3.1 entry point: one category, one number, no I/O. */
export function computeCategoryPct(category: CategoryKey, inputs: ScoringInputs): number | null {
  return BUILDERS[category](inputs).pct;
}

export function allCategories(i: ScoringInputs): Record<CategoryKey, CategoryResult> {
  return Object.fromEntries(
    CATEGORIES.map((k) => [k, BUILDERS[k](i)]),
  ) as Record<CategoryKey, CategoryResult>;
}
