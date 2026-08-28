import {
  tierPoints, quantityPoints, type TierKey,
} from "./tiers";

/* ═══════════════════════════════════════════════════════════════
   Seven categories, every sub-habit specified, all on one scale.

   Each sub-habit is already 0–20, so a category is the weighted
   average of its sub-habits and lands 0–20 with no separate
   normalisation step anywhere. Weights are percentages and sum to
   100 within each category.

   Deen alone carries a hard ceiling: completed obligatory prayers
   set a limit no amount of voluntary worship can exceed.
   ═══════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
  "deen", "discipline", "health", "work", "relationships", "financial", "growth",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export const FOUNDATION_CATEGORIES: CategoryKey[] = ["deen", "discipline", "health"];
export const RESPONSIBILITY_CATEGORIES: CategoryKey[] = ["work", "relationships", "financial"];
export const GROWTH_CATEGORIES: CategoryKey[] = ["growth"];

export type InputType = "tier" | "prayer" | "quantity";

export type SubHabit = {
  key: string;
  label: string;
  weight: number;
  input: InputType;
  /** Shown above the tier row, phrased as a question. */
  prompt?: string;
  /** For quantity habits: the unit and where the target comes from. */
  unit?: string;
  hint?: string;
  /** Quantity habits the app already knows from elsewhere in the app. */
  derived?: boolean;
};

export type CategoryDef = {
  key: CategoryKey;
  label: string;
  ar?: string;
  icon: string;
  blurb: string;
  subs: SubHabit[];
};

export const CATEGORY_DEFS: Record<CategoryKey, CategoryDef> = {
  deen: {
    key: "deen", label: "Deen", ar: "الدين", icon: "🕌",
    blurb: "Completed prayers set a ceiling nothing else can exceed.",
    subs: [
      { key: "fajr",    label: "Fajr",    weight: 12, input: "prayer", derived: true },
      { key: "dhuhr",   label: "Dhuhr",   weight: 12, input: "prayer", derived: true },
      { key: "asr",     label: "Asr",     weight: 12, input: "prayer", derived: true },
      { key: "maghrib", label: "Maghrib", weight: 12, input: "prayer", derived: true },
      { key: "isha",    label: "Isha",    weight: 12, input: "prayer", derived: true },
      { key: "quran",   label: "Qur'an",  weight: 20, input: "quantity",
        unit: "pages", hint: "Against your daily page target", derived: true },
      { key: "dhikr",     label: "Dhikr",     weight: 10, input: "tier",
        prompt: "How was your dhikr today?" },
      { key: "muhasabah", label: "Muhasabah", weight: 10, input: "tier",
        prompt: "Did you take account of yourself today?" },
    ],
  },

  discipline: {
    key: "discipline", label: "Discipline", icon: "🧠",
    blurb: "Whether your word to yourself holds.",
    subs: [
      { key: "woke_per_plan",  label: "Woke up per plan",      weight: 15, input: "tier",
        prompt: "Did you get up when you said you would?" },
      { key: "top_priority",   label: "Completed #1 priority", weight: 25, input: "tier",
        prompt: "Did you finish the one thing that mattered most?" },
      { key: "kept_promises",  label: "Kept promises",         weight: 25, input: "tier",
        prompt: "Did you keep what you promised today?" },
      { key: "punctuality",    label: "Punctuality",           weight: 10, input: "tier",
        prompt: "Were you on time to what you had scheduled?" },
      { key: "avoided_excuses", label: "Avoided excuses",      weight: 10, input: "tier",
        prompt: "Did you go without making excuses?" },
      { key: "difficult_task", label: "Did the difficult thing", weight: 15, input: "tier",
        prompt: "Did you do something hard despite resistance?" },
    ],
  },

  health: {
    key: "health", label: "Health", icon: "💪",
    blurb: "The floor, not a fitness programme.",
    subs: [
      { key: "sleep",       label: "Sleep",             weight: 30, input: "quantity",
        unit: "hours", hint: "Against your sleep target", derived: true },
      { key: "wake_consistency", label: "Wake consistency", weight: 15, input: "tier",
        prompt: "Did you wake near your usual time?" },
      { key: "exercise",    label: "Exercise / movement", weight: 25, input: "tier",
        prompt: "Did you move your body?" },
      { key: "hygiene",     label: "Hygiene",           weight: 15, input: "tier",
        prompt: "Did you keep yourself clean and presentable?" },
      { key: "energy",      label: "Energy level",      weight: 15, input: "tier",
        prompt: "How was your energy today?" },
    ],
  },

  work: {
    key: "work", label: "Work", icon: "💼",
    blurb: "Value delivered, never hours at a desk.",
    subs: [
      { key: "mit",          label: "Most important task", weight: 35, input: "tier",
        prompt: "Did you complete the most important task?" },
      { key: "deep_work",    label: "Deep work",           weight: 30, input: "quantity",
        unit: "hours", hint: "Against your focus target", derived: true },
      { key: "commitments",  label: "Commitments kept",    weight: 20, input: "quantity",
        unit: "met of due", hint: "Pulled from your commitments", derived: true },
      { key: "value_created", label: "Value created",      weight: 15, input: "tier",
        prompt: "How much real value did you deliver?" },
    ],
  },

  relationships: {
    key: "relationships", label: "Relationships", ar: "الأهل", icon: "❤️",
    blurb: "The people you owe your presence to.",
    subs: [
      { key: "family_interaction", label: "Family interaction",   weight: 35, input: "tier",
        prompt: "Were you genuinely present with your family?" },
      { key: "responsibility",     label: "Responsibility met",   weight: 35, input: "tier",
        prompt: "Did you fulfil a responsibility toward them?" },
      { key: "friendships",        label: "Friendships & community", weight: 15, input: "tier",
        prompt: "Did you tend a friendship today?" },
      { key: "professional",       label: "Professional relationships", weight: 15, input: "tier",
        prompt: "Did you invest in a working relationship?" },
    ],
  },

  financial: {
    key: "financial", label: "Financial", icon: "💰",
    blurb: "Stabilise, reduce debt, then save.",
    subs: [
      { key: "no_unnecessary", label: "No unnecessary spending", weight: 30, input: "tier",
        prompt: "How disciplined was your spending?" },
      { key: "money_action",   label: "Planned money action",    weight: 30, input: "tier",
        prompt: "Did you make a repayment, saving or budgeting move?" },
      { key: "logged",         label: "Income & expenses logged", weight: 20, input: "tier",
        prompt: "Did you record what came in and went out?" },
      { key: "debt_progress",  label: "Debt repayment progress",  weight: 20, input: "quantity",
        unit: "MAD this month", hint: "Against your monthly target — moves monthly, not daily",
        derived: true },
    ],
  },

  growth: {
    key: "growth", label: "Growth", icon: "📚",
    blurb: "Application beats consumption.",
    subs: [
      { key: "learning_session", label: "Learning session",   weight: 30, input: "tier",
        prompt: "Did you sit down and learn something?" },
      { key: "applied",          label: "Applied it",         weight: 40, input: "tier",
        prompt: "Did you use what you learned on something real?" },
      { key: "skill_improvement", label: "Skill improvement noted", weight: 15, input: "tier",
        prompt: "Did you notice a skill getting better?" },
      { key: "project_progress", label: "Project progress",   weight: 15, input: "tier",
        prompt: "Did a project of yours move forward?" },
    ],
  },
};

export const CATEGORY_LABELS: Record<CategoryKey, { en: string; ar?: string; icon: string }> =
  Object.fromEntries(
    CATEGORIES.map((k) => [k, {
      en: CATEGORY_DEFS[k].label, ar: CATEGORY_DEFS[k].ar, icon: CATEGORY_DEFS[k].icon,
    }]),
  ) as any;

/* ── Status bands ─────────────────────────────────────────────── */

export const STATUSES = [
  "critical", "below_standard", "pass", "good", "strong", "exceptional",
] as const;
export type StatusKey = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<StatusKey, string> = {
  critical: "Critical",
  below_standard: "Below standard",
  pass: "Pass",
  good: "Good",
  strong: "Strong",
  exceptional: "Exceptional",
};

/** Describes performance and consistency, never the person. */
export function statusFor(score: number): StatusKey {
  if (score <= 4) return "critical";
  if (score <= 9) return "below_standard";
  if (score <= 12) return "pass";
  if (score <= 15) return "good";
  if (score <= 18) return "strong";
  return "exceptional";
}

/* ── The Deen ceiling ─────────────────────────────────────────── */

/** Completed obligatory prayers set the highest the Deen score can
 *  reach. Hardcoded by design — not configurable in V1. */
export const DEEN_CEILING: Record<number, number> = {
  5: 20, 4: 16, 3: 12, 2: 8, 1: 5, 0: 3,
};

/* ── Computation ──────────────────────────────────────────────── */

/** Points for one sub-habit, or null when it has not been logged. */
export type SubScore = {
  key: string;
  label: string;
  weight: number;
  input: InputType;
  points: number | null;
  /** What was actually entered — the tier key, or "6.5 hours". */
  rawValue: string | null;
  detail?: string;
};

export type CategoryScore = {
  key: CategoryKey;
  label: string;
  ar?: string;
  icon: string;
  /** The weighted average before any ceiling. */
  weightedScore: number;
  /** The ceiling in force today, whether or not it is currently
   *  binding. Showing only the binding value made the prayer log
   *  report a ceiling of 20 on a day with no prayers prayed. */
  ceiling: number | null;
  capApplied: number | null;
  score: number;
  status: StatusKey;
  subs: SubScore[];
  loggedCount: number;
  totalCount: number;
};

export type CategoryInput = {
  /** subHabitKey → points 0–20, or null/absent when unlogged. */
  points: Record<string, number | null>;
  /** subHabitKey → what was entered, for the breakdown view. */
  raw?: Record<string, string | null>;
  detail?: Record<string, string | undefined>;
};

/** Weighted average over the sub-habits that have a value.
 *
 *  While a day is open, unlogged sub-habits are excluded and the
 *  remaining weights carry the average — a morning is not a failure.
 *  Once the day is closed, an unlogged sub-habit counts as zero,
 *  because you were asked and left it blank. */
export function computeCategory(
  key: CategoryKey,
  input: CategoryInput,
  finalized: boolean,
  prayersCompleted?: number,
): CategoryScore {
  const def = CATEGORY_DEFS[key];

  const subs: SubScore[] = def.subs.map((s) => ({
    key: s.key,
    label: s.label,
    weight: s.weight,
    input: s.input,
    points: input.points[s.key] ?? null,
    rawValue: input.raw?.[s.key] ?? null,
    detail: input.detail?.[s.key],
  }));

  const counted = subs.filter((s) => s.points !== null || finalized);
  const totalWeight = counted.reduce((a, s) => a + s.weight, 0);
  const weighted = totalWeight > 0
    ? counted.reduce((a, s) => a + (s.points ?? 0) * s.weight, 0) / totalWeight
    : 0;
  const weightedScore = Math.round(weighted);

  // Deen is the only category with a ceiling in V1.
  let cap: number | null = null;
  if (key === "deen" && prayersCompleted !== undefined) {
    cap = DEEN_CEILING[Math.max(0, Math.min(5, prayersCompleted))] ?? DEEN_CEILING[0];
  }
  const score = cap === null ? weightedScore : Math.min(weightedScore, cap);

  return {
    key, label: def.label, ar: def.ar, icon: def.icon,
    weightedScore,
    ceiling: cap,
    capApplied: cap !== null && cap < weightedScore ? cap : null,
    score,
    status: statusFor(score),
    subs,
    loggedCount: subs.filter((s) => s.points !== null).length,
    totalCount: subs.length,
  };
}

export { tierPoints, quantityPoints };
export type { TierKey };
