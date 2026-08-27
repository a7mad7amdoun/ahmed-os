/* ═══════════════════════════════════════════════════════════════
   Category scoring — eight independent 0–100% scores per day.

   Every category is a weighted average of its own sub-metrics, and
   every sub-metric reports the raw number behind it. Nothing here
   is a black box: the UI can always show what produced a figure.

   Obligatory sub-metrics carry roughly twice the weight of optional
   ones, and obligatory acts never share a sub-metric with optional
   ones — Sunnah cannot quietly stand in for Fard.
   ═══════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
  "deen", "discipline", "health", "work", "family", "financial", "growth", "business",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export const FOUNDATION_CATEGORIES: CategoryKey[] = ["deen", "discipline", "health"];
export const LIFE_CATEGORIES: CategoryKey[] = ["work", "family", "financial", "growth", "business"];

export const CATEGORY_LABELS: Record<CategoryKey, { en: string; ar?: string }> = {
  deen:       { en: "Deen", ar: "الدين" },
  discipline: { en: "Discipline" },
  health:     { en: "Health" },
  work:       { en: "Work" },
  family:     { en: "Family", ar: "الأهل" },
  financial:  { en: "Financial" },
  growth:     { en: "Growth" },
  business:   { en: "Business" },
};

/** Default weights. Stored in the database; these are only the seed. */
export const DEFAULT_WEIGHTS: Record<CategoryKey, number> = {
  deen: 35, discipline: 25, health: 15,
  work: 15, family: 5, financial: 2, growth: 2, business: 1,
};

export type SubMetric = {
  key: string;
  label: string;
  /** 0..1, or null when there is nothing logged to judge. */
  value: number | null;
  weight: number;
  obligatory?: boolean;
  detail: string;
};

export type CategoryResult = {
  key: CategoryKey;
  label: string;
  ar?: string;
  /** 0..100, or null when the category has nothing logged at all. */
  pct: number | null;
  subs: SubMetric[];
};

export type ScoringInputs = {
  // Deen
  prayersPerformed: number;
  prayersOnTime: number;
  elapsedPrayers: number;
  quranPages: number | null;
  quranGoalPages: number;
  dhikrDone: boolean | null;
  muhasabahDone: boolean;
  // Discipline
  commitmentsDue: number;
  commitmentsKept: number;
  keptPromises: boolean | null;
  wasHonest: boolean | null;
  madeExcuses: boolean | null;
  // Health
  sleepMinutes: number | null;
  sleepGoalHours: number;
  wakeConsistentMinutes: number | null;  // deviation from recent median
  movement: boolean | null;
  hygiene: boolean | null;
  // Work
  topPriority: string | null;
  topPriorityDone: boolean | null;
  deepWorkMinutes: number | null;
  deepWorkTargetMinutes: number;
  workCommitmentsDue: number;
  workCommitmentsKept: number;
  valueCreated: string | null;
  // Family
  familyContact: boolean | null;
  familyResponsibility: boolean | null;
  // Financial
  unnecessarySpend: number | null;
  spendLogged: boolean;
  moneyActionTaken: boolean | null;   // a repayment or saving logged
  // Growth
  learningMinutes: number | null;
  learningTargetMinutes: number;
  learningApplied: boolean | null;
  // Business
  businessActivityToday: number | null;
  businessWeeklyPace: number | null;  // 0..1 against weekly target
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Weighted mean over sub-metrics that have a value. Returns null if
 *  none do — an unlogged category must not read as a zero. */
function rollup(subs: SubMetric[]): number | null {
  const live = subs.filter((s) => s.value !== null);
  if (!live.length) return null;
  const wsum = live.reduce((a, s) => a + s.weight, 0);
  if (wsum === 0) return null;
  const v = live.reduce((a, s) => a + s.value! * s.weight, 0) / wsum;
  return r2(clamp01(v) * 100);
}

function cat(key: CategoryKey, subs: SubMetric[]): CategoryResult {
  return { key, label: CATEGORY_LABELS[key].en, ar: CATEGORY_LABELS[key].ar, pct: rollup(subs), subs };
}

export function deenCategory(i: ScoringInputs): CategoryResult {
  const e = Math.max(0, Math.min(5, i.elapsedPrayers));
  const pages = i.quranPages;
  return cat("deen", [
    {
      key: "prayers_performed", label: "Obligatory prayers prayed", obligatory: true, weight: 2,
      value: e === 0 ? null : i.prayersPerformed / e,
      detail: e === 0 ? "No prayer has entered yet" : `${i.prayersPerformed} of ${e} prayed`,
    },
    {
      key: "prayers_on_time", label: "Prayed within the window", obligatory: true, weight: 2,
      value: e === 0 ? null : i.prayersOnTime / e,
      detail: e === 0 ? "—" : `${i.prayersOnTime} of ${e} on time`,
    },
    {
      key: "quran", label: "Qur'an", weight: 1,
      value: pages === null ? null : pages >= i.quranGoalPages ? 1 : pages > 0 ? 0.6 : 0,
      detail: pages === null ? "Not logged"
        : pages <= 0 ? "Not opened today"
        : pages >= i.quranGoalPages ? `${pages} pages — goal met`
        : `${pages} pages — opened, below goal`,
    },
    {
      key: "dhikr", label: "Dhikr", weight: 1,
      value: i.dhikrDone === null ? null : i.dhikrDone ? 1 : 0,
      detail: i.dhikrDone === null ? "Not logged" : i.dhikrDone ? "Done" : "Not done",
    },
    {
      key: "muhasabah", label: "Muhasabah written", weight: 1,
      value: i.muhasabahDone ? 1 : 0,
      // Only completion is scored. The content is never read by any
      // scoring or analytics code.
      detail: i.muhasabahDone ? "Written" : "Not written",
    },
  ]);
}

export function disciplineCategory(i: ScoringInputs): CategoryResult {
  return cat("discipline", [
    {
      key: "commitments", label: "Promises kept", weight: 2,
      value: i.commitmentsDue === 0 ? null : i.commitmentsKept / i.commitmentsDue,
      detail: i.commitmentsDue === 0 ? "None due today"
        : `${i.commitmentsKept} of ${i.commitmentsDue} kept`,
    },
    {
      key: "self_promises", label: "Kept my word to myself", weight: 1,
      value: i.keptPromises === null ? null : i.keptPromises ? 1 : 0,
      detail: i.keptPromises === null ? "Not logged" : i.keptPromises ? "Yes" : "No",
    },
    {
      key: "honesty", label: "Honest", weight: 1,
      value: i.wasHonest === null ? null : i.wasHonest ? 1 : 0,
      detail: i.wasHonest === null ? "Not logged" : i.wasHonest ? "Yes" : "No",
    },
    {
      key: "excuses", label: "Free of excuses", weight: 1,
      value: i.madeExcuses === null ? null : i.madeExcuses ? 0 : 1,
      detail: i.madeExcuses === null ? "Not logged" : i.madeExcuses ? "Excuses made" : "None",
    },
  ]);
}

export function healthCategory(i: ScoringInputs): CategoryResult {
  const h = i.sleepMinutes === null ? null : i.sleepMinutes / 60;
  return cat("health", [
    {
      key: "sleep", label: "Sleep", weight: 2,
      value: h === null ? null : clamp01(h / i.sleepGoalHours),
      detail: h === null ? "Not logged" : `${h.toFixed(1)}h of ${i.sleepGoalHours}h target`,
    },
    {
      key: "wake_consistency", label: "Wake-time consistency", weight: 1,
      value: i.wakeConsistentMinutes === null ? null
        : clamp01(1 - i.wakeConsistentMinutes / 120),
      detail: i.wakeConsistentMinutes === null ? "Needs a few days of data"
        : `${Math.round(i.wakeConsistentMinutes)} min from your usual wake time`,
    },
    {
      key: "movement", label: "Movement", weight: 1,
      value: i.movement === null ? null : i.movement ? 1 : 0,
      detail: i.movement === null ? "Not logged" : i.movement ? "Moved" : "None",
    },
    {
      key: "hygiene", label: "Hygiene", weight: 1,
      value: i.hygiene === null ? null : i.hygiene ? 1 : 0,
      detail: i.hygiene === null ? "Not logged" : i.hygiene ? "Yes" : "No",
    },
  ]);
}

export function workCategory(i: ScoringInputs): CategoryResult {
  const dw = i.deepWorkMinutes;
  return cat("work", [
    {
      key: "most_important", label: "Most important task", weight: 2,
      value: !i.topPriority ? null : i.topPriorityDone ? 1 : 0,
      detail: !i.topPriority ? "None named" : i.topPriorityDone ? "Completed" : "Not completed",
    },
    {
      key: "deep_work", label: "Deep work", weight: 1.5,
      value: dw === null ? null : clamp01(dw / i.deepWorkTargetMinutes),
      detail: dw === null ? "Not logged"
        : `${(dw / 60).toFixed(1)}h of ${(i.deepWorkTargetMinutes / 60).toFixed(1)}h target`,
    },
    {
      key: "work_commitments", label: "Work commitments met", weight: 1,
      value: i.workCommitmentsDue === 0 ? null : i.workCommitmentsKept / i.workCommitmentsDue,
      detail: i.workCommitmentsDue === 0 ? "None due"
        : `${i.workCommitmentsKept} of ${i.workCommitmentsDue}`,
    },
    {
      key: "value", label: "Value named", weight: 0.5,
      value: i.valueCreated === null ? null : i.valueCreated.trim() ? 1 : 0,
      detail: i.valueCreated?.trim() ? "Something delivered" : "Nothing named",
    },
    // Hours worked deliberately absent: this category measures value,
    // not time at a desk.
  ]);
}

export function familyCategory(i: ScoringInputs): CategoryResult {
  return cat("family", [
    {
      key: "interaction", label: "Meaningful interaction", weight: 1,
      value: i.familyContact === null ? null : i.familyContact ? 1 : 0,
      detail: i.familyContact === null ? "Not logged" : i.familyContact ? "Yes" : "None today",
    },
    {
      key: "responsibility", label: "Responsibility fulfilled", weight: 1,
      value: i.familyResponsibility === null ? null : i.familyResponsibility ? 1 : 0,
      detail: i.familyResponsibility === null ? "Not logged" : i.familyResponsibility ? "Yes" : "No",
    },
  ]);
}

export function financialCategory(i: ScoringInputs): CategoryResult {
  const s = i.unnecessarySpend;
  return cat("financial", [
    {
      key: "unnecessary", label: "No unnecessary spending", weight: 2,
      value: !i.spendLogged || s === null ? null : s === 0 ? 1 : s < 50 ? 0.5 : 0,
      detail: !i.spendLogged ? "Not logged"
        : s === 0 ? "Nothing wasted" : `${s} MAD unnecessary`,
    },
    {
      key: "money_action", label: "Repayment or saving made", weight: 1,
      value: i.moneyActionTaken === null ? null : i.moneyActionTaken ? 1 : 0,
      detail: i.moneyActionTaken === null ? "Not logged"
        : i.moneyActionTaken ? "Yes" : "None today",
    },
  ]);
}

export function growthCategory(i: ScoringInputs): CategoryResult {
  const m = i.learningMinutes;
  return cat("growth", [
    {
      key: "learning", label: "Learning time", weight: 1,
      value: m === null ? null : clamp01(m / i.learningTargetMinutes),
      detail: m === null ? "Not logged" : `${m} min`,
    },
    {
      // Weighted above the learning itself: this is the whole guard
      // against learning as a way of avoiding the difficult work.
      key: "applied", label: "Applied to something real", weight: 1.5,
      value: m === null ? null : i.learningApplied ? 1 : 0,
      detail: m === null ? "Not logged"
        : i.learningApplied ? "Used it" : "Learned, not yet applied — partial credit only",
    },
  ]);
}

export function businessCategory(i: ScoringInputs): CategoryResult {
  return cat("business", [
    {
      key: "activity", label: "Activity logged", weight: 1,
      value: i.businessActivityToday === null ? null : i.businessActivityToday > 0 ? 1 : 0,
      detail: i.businessActivityToday === null ? "Not logged"
        : i.businessActivityToday > 0 ? `${i.businessActivityToday} logged` : "Nothing today",
    },
    {
      key: "pace", label: "Against weekly target", weight: 1,
      value: i.businessWeeklyPace === null ? null : clamp01(i.businessWeeklyPace),
      detail: i.businessWeeklyPace === null ? "No active project"
        : `${Math.round(i.businessWeeklyPace * 100)}% of this week's target`,
    },
  ]);
}

export function allCategories(i: ScoringInputs): Record<CategoryKey, CategoryResult> {
  return {
    deen: deenCategory(i),
    discipline: disciplineCategory(i),
    health: healthCategory(i),
    work: workCategory(i),
    family: familyCategory(i),
    financial: financialCategory(i),
    growth: growthCategory(i),
    business: businessCategory(i),
  };
}
