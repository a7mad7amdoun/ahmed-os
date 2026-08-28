import {
  statusFor, STATUS_LABELS,
  FOUNDATION_CATEGORIES, RESPONSIBILITY_CATEGORIES, GROWTH_CATEGORIES,
  type CategoryKey, type CategoryScore, type StatusKey,
} from "./categories";

/* ═══════════════════════════════════════════════════════════════
   Three headline scores, never merged into one.

   Averaging them would let a strong day at work hide a foundation
   that did not hold — the exact failure this app exists to prevent.
   Where one glance-anchor is needed, the app reports the status of
   the WEAKEST of the three and names it, so the bottleneck is always
   the thing you see first.
   ═══════════════════════════════════════════════════════════════ */

export const MAJORS = ["foundation", "responsibility", "growth"] as const;
export type MajorKey = (typeof MAJORS)[number];

export const MAJOR_LABELS: Record<MajorKey, { en: string; ar?: string; icon: string }> = {
  foundation:     { en: "Foundation", ar: "الأساس", icon: "🕌" },
  responsibility: { en: "Responsibility", icon: "💼" },
  growth:         { en: "Growth", icon: "🧠" },
};

export const MAJOR_MEMBERS: Record<MajorKey, CategoryKey[]> = {
  foundation: FOUNDATION_CATEGORIES,
  responsibility: RESPONSIBILITY_CATEGORIES,
  growth: GROWTH_CATEGORIES,
};

export type MajorScore = {
  key: MajorKey;
  label: string;
  ar?: string;
  icon: string;
  score: number;
  status: StatusKey;
  statusLabel: string;
  members: CategoryScore[];
};

export type DayScores = {
  categories: Record<CategoryKey, CategoryScore>;
  majors: Record<MajorKey, MajorScore>;
  weakest: MajorScore;
  overallStatus: StatusKey;
  overallStatusLabel: string;
  /** "Health is your bottleneck today" — named, not just implied. */
  bottleneckLine: string;
  evaluation: Evaluation;
  loggedSubs: number;
  totalSubs: number;
};

export function rollUp(
  categories: Record<CategoryKey, CategoryScore>,
  elapsedPrayers = 5,
  finalized = true,
): DayScores {
  const majors = Object.fromEntries(
    MAJORS.map((k) => {
      const members = MAJOR_MEMBERS[k].map((c) => categories[c]);
      const score = members.length
        ? Math.round(members.reduce((a, m) => a + m.score, 0) / members.length)
        : 0;
      const L = MAJOR_LABELS[k];
      const status = statusFor(score);
      return [k, {
        key: k, label: L.en, ar: L.ar, icon: L.icon,
        score, status, statusLabel: STATUS_LABELS[status], members,
      } satisfies MajorScore];
    }),
  ) as Record<MajorKey, MajorScore>;

  const weakest = MAJORS.map((k) => majors[k]).reduce((lo, m) => (m.score < lo.score ? m : lo));

  // Name the specific category dragging the weakest group down.
  const worstCat = weakest.members.reduce((lo, c) => (c.score < lo.score ? c : lo));
  const bottleneckLine = `${worstCat.label} is your bottleneck today`;

  const loggedSubs = Object.values(categories).reduce((a, c) => a + c.loggedCount, 0);
  const totalSubs = Object.values(categories).reduce((a, c) => a + c.totalCount, 0);

  return {
    categories, majors, weakest,
    overallStatus: weakest.status,
    overallStatusLabel: weakest.statusLabel,
    bottleneckLine,
    evaluation: evaluateDay(majors, elapsedPrayers, finalized, loggedSubs),
    loggedSubs, totalSubs,
  };
}

/* ─────────────────────────────────────────────────────────────
   A named state alongside the numbers. None of these describes
   the person, and none calls a day worthless.
   ───────────────────────────────────────────────────────────── */

export type DayState =
  | "early" | "strong" | "foundation_held" | "responsibility_only" | "slipping" | "broken";

export type Evaluation = {
  state: DayState;
  headline: string;
  note: string;
  /** Reset is suggested when a headline score sits in Critical or
   *  Below Standard. It is offered, never forced. */
  suggestReset: boolean;
};

export function evaluateDay(
  majors: Record<MajorKey, MajorScore>,
  elapsedPrayers: number,
  finalized: boolean,
  loggedSubs = 0,
): Evaluation {
  const f = majors.foundation.score;
  const r = majors.responsibility.score;

  if (!finalized && loggedSubs === 0) {
    return {
      state: "early",
      headline: "Nothing logged yet today",
      note: "Open a category below and tap as the day goes — you do not have to do it all at once.",
      suggestReset: false,
    };
  }
  if (f >= 13 && r >= 13) {
    return {
      state: "strong",
      headline: "Foundation held, and you moved forward",
      note: "This is the shape of a good day. Repeat it tomorrow.",
      suggestReset: false,
    };
  }
  if (f >= 13) {
    return {
      state: "foundation_held",
      headline: "Foundation held",
      note: "The rest was quieter today. That is a far smaller problem than the reverse.",
      suggestReset: false,
    };
  }
  if (r >= 13 && f <= 9) {
    return {
      state: "responsibility_only",
      headline: "Productive, but the foundation slipped",
      note: "Work went well. It does not cover what was missed underneath it.",
      suggestReset: true,
    };
  }
  if (f >= 10) {
    return {
      state: "slipping",
      headline: "The foundation slipped today",
      note: "Recoverable. Name the cause before it becomes the week.",
      suggestReset: false,
    };
  }
  return {
    state: "broken",
    headline: "Today did not hold",
    note: "This is one day. The danger is not today — it is waiting until Monday.",
    suggestReset: true,
  };
}

/* ── Streaks: current and longest tracked apart. A missed day sets
      the current run to zero but never erases the longest. ── */

export type StreakInfo = { current: number; longest: number; lastHit: string | null };

export function streaks<T extends { date: string }>(
  rows: T[], hit: (r: T) => boolean,
): StreakInfo {
  let longest = 0, run = 0, current = 0;
  let lastHit: string | null = null;
  for (const r of rows) {
    if (hit(r)) { run++; lastHit = r.date; if (run > longest) longest = run; }
    else run = 0;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (hit(rows[i])) current++; else break;
  }
  return { current, longest, lastHit };
}

export { statusFor, STATUS_LABELS };
export type { StatusKey, CategoryKey, CategoryScore };
