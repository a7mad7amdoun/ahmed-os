import {
  allCategories, FOUNDATION_CATEGORIES, LIFE_CATEGORIES,
  DEFAULT_WEIGHTS, CATEGORY_LABELS,
  type CategoryKey, type CategoryResult, type ScoringInputs,
} from "./categories";

/* ═══════════════════════════════════════════════════════════════
   Roll-up: eight category percentages → two gated scores → one
   Overall percentage.

   The eight weights are GLOBAL: they sum to 100 and are the only
   weighting in the system. Foundation and Life Progress are views
   over that same weighted sum, never a second blend applied on top.
   An earlier revision normalised weights *within* each group and then
   blended the groups 0.6/0.4, which silently turned a configured
   Deen 35 / Work 15 into an effective 28 / 24 — inverting the whole
   priority hierarchy while the settings page still read 35 / 15.
   `foundationShare` is therefore derived from the weights in play,
   never configured.

   The gate is applied unconditionally rather than behind an
   `if (foundation < 40)` threshold. A threshold makes the Overall
   score jump discontinuously either side of the boundary and
   inverts the marginal value of Foundation right where it should be
   steadiest. Applied always, the ceiling binds exactly when
   Life exceeds Foundation by more than (1 - share)/share × offset,
   which is the productive-but-collapsed day it was written for, and
   the two branches meet continuously at that point.
   ═══════════════════════════════════════════════════════════════ */

export type Contribution = {
  key: CategoryKey;
  label: string;
  ar?: string;
  pct: number | null;
  weight: number;
  /** Percentage points this category contributed to its parent score. */
  contributed: number;
  counted: boolean;
};

export type Score = {
  /** 0–100, or null when nothing in the group is logged. */
  pct: number | null;
  /** The same figure expressed 0–20. */
  score: number;
  contributions: Contribution[];
  /** Global weight actually in play for this group today. Drives the
   *  Overall blend, so a group with categories unlogged carries
   *  proportionally less rather than being silently treated as full. */
  countedWeight: number;
};

export type ScoringSettings = {
  /** Global weights across all eight categories. Sum is not required to
   *  be 100 — the roll-up normalises — but keeping it at 100 makes each
   *  number readable as a straight percentage of the day. */
  weights: Record<CategoryKey, number>;
  gateCapOffset: number;     // default 15
};

export const DEFAULT_SCORING: ScoringSettings = {
  weights: { ...DEFAULT_WEIGHTS },
  gateCapOffset: 15,
};

/** What the configured weights imply, for display and for the gate copy.
 *  Derived, never stored — the weights are the single source of truth. */
export function derivedShares(weights: Record<CategoryKey, number>) {
  const sum = (ks: CategoryKey[]) => ks.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const wF = sum(FOUNDATION_CATEGORIES), wL = sum(LIFE_CATEGORIES);
  const tot = wF + wL;
  const foundationShare = tot > 0 ? wF / tot : 0;
  const lifeShare = 1 - foundationShare;
  return { foundationWeight: wF, lifeWeight: wL, foundationShare, lifeShare };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Weighted blend of a group of categories.
 *  `finalized` decides how an unlogged category is treated: while the
 *  day is still running it is excluded and the remaining weights are
 *  renormalised, so a morning is not scored as a failure. Once the day
 *  is closed, a blank counts as zero — you were asked and left it. */
function group(
  cats: Record<CategoryKey, CategoryResult>,
  keys: CategoryKey[],
  weights: Record<CategoryKey, number>,
  finalized: boolean,
): Score {
  const contributions: Contribution[] = [];
  let weighted = 0, totalWeight = 0;

  for (const k of keys) {
    const c = cats[k];
    const w = weights[k] ?? 0;
    const has = c.pct !== null;
    const counted = has || finalized;
    const value = has ? c.pct! : 0;

    if (counted) { weighted += value * w; totalWeight += w; }
    contributions.push({
      key: k, label: CATEGORY_LABELS[k].en, ar: CATEGORY_LABELS[k].ar,
      pct: c.pct, weight: w, counted,
      contributed: 0, // filled below, once totalWeight is final
    });
  }

  const pct = totalWeight > 0 ? r2(weighted / totalWeight) : null;
  for (const c of contributions) {
    c.contributed = c.counted && totalWeight > 0
      ? r2(((c.pct ?? 0) * c.weight) / totalWeight) : 0;
  }
  return {
    pct, score: pct === null ? 0 : r1(pct * 0.2),
    contributions, countedWeight: totalWeight,
  };
}

export type DayRollup = {
  categories: Record<CategoryKey, CategoryResult>;
  foundation: Score;
  life: Score;
  /** 0–100. Never a plain average of the two above. */
  overallPct: number | null;
  /** The blended figure before the ceiling was applied. */
  ungatedPct: number | null;
  /** The ceiling the foundation imposed today. */
  gateCeiling: number | null;
  /** Share of today's counted weight sitting in Foundation. Derived from
   *  the weights, and lower on a day where a foundation category was
   *  never logged. */
  foundationShare: number;
  /** True when the ceiling actually bound — i.e. work was carrying a
   *  day the foundation was not. */
  gated: boolean;
  evaluation: Evaluation;
};

export function rollUpDay(
  inputs: ScoringInputs,
  settings: ScoringSettings,
  /** Optional override. When omitted, `inputs.finalized` decides — the
   *  two must never disagree, or categories and groups would treat the
   *  same blank differently. */
  finalized?: boolean,
): DayRollup {
  const fin = finalized ?? inputs.finalized;
  const scoped: ScoringInputs = fin === inputs.finalized ? inputs : { ...inputs, finalized: fin };
  const cats = allCategories(scoped);
  const foundation = group(cats, FOUNDATION_CATEGORIES, settings.weights, fin);
  const life = group(cats, LIFE_CATEGORIES, settings.weights, fin);

  const F = foundation.pct;
  const L = life.pct;

  /* One weighted mean over all eight categories at their global weights.
     Because each group's pct is itself that group's weighted mean, this
     is identical to blending F and L by the weight each actually carries
     today — which is what makes the two panels on screen add up to the
     Overall figure instead of merely gesturing at it. */
  const wF = foundation.countedWeight;
  const wL = life.countedWeight;
  const wTot = wF + wL;
  const share = wTot > 0 ? wF / wTot : 0;

  let ungated: number | null = null;
  let ceiling: number | null = null;
  let overall: number | null = null;
  let gated = false;

  if (wTot > 0 && (F !== null || L !== null)) {
    const f = F ?? 0;
    const l = L ?? 0;
    ungated = r2((f * wF + l * wL) / wTot);
    ceiling = r2(f + settings.gateCapOffset);
    overall = r2(Math.min(ungated, ceiling));
    gated = ungated > ceiling;
  }

  return {
    categories: cats,
    foundation, life,
    overallPct: overall, ungatedPct: ungated, gateCeiling: ceiling, gated,
    foundationShare: r2(share),
    evaluation: evaluateDay(F, L, overall, gated, ceiling, inputs.elapsedPrayers),
  };
}

/* ─────────────────────────────────────────────────────────────
   The verdict stays a named state alongside the number, so the
   Overall figure never becomes the whole story. No state calls a
   day worthless; tests assert the vocabulary.
   ───────────────────────────────────────────────────────────── */

export type DayState =
  | "early" | "strong" | "foundation_held" | "growth_only" | "slipping" | "broken";

export type Evaluation = {
  state: DayState;
  headline: string;
  note: string;
  suggestReset: boolean;
};

export function evaluateDay(
  foundationPct: number | null,
  lifePct: number | null,
  overallPct: number | null,
  gated: boolean,
  gateCeiling: number | null,
  elapsedPrayers: number,
): Evaluation {
  const F = foundationPct ?? 0;
  const L = lifePct ?? 0;

  if (elapsedPrayers <= 1 && F === 0 && L === 0) {
    return {
      state: "early",
      headline: "The day is still ahead of you",
      note: "Nothing is decided yet.",
      suggestReset: false,
    };
  }
  if (F >= 70 && L >= 60) {
    return {
      state: "strong",
      headline: "Foundation held, and you moved forward",
      note: "This is the shape of a good day. Repeat it tomorrow.",
      suggestReset: false,
    };
  }
  if (F >= 70) {
    return {
      state: "foundation_held",
      headline: "Foundation held",
      note: "Growth was quiet today. That is a far smaller problem than the reverse.",
      suggestReset: false,
    };
  }
  if (gated) {
    return {
      state: "growth_only",
      headline: "Productive, but the foundation slipped",
      note: `Work went well. The day is capped at ${Math.round(gateCeiling ?? F)}% because of what was missed underneath it.`,
      suggestReset: true,
    };
  }
  if (F >= 40) {
    return {
      state: "slipping",
      headline: "The foundation slipped today",
      note: "Recoverable. Name the cause before it becomes the week.",
      suggestReset: true,
    };
  }
  return {
    state: "broken",
    headline: "Today did not hold",
    note: "This is one day. The danger is not today — it is waiting until Monday.",
    suggestReset: true,
  };
}

/* ── Streaks: current and longest tracked apart, and a return after
      a gap is never rendered as a reset to zero. ── */

export type StreakInfo = { current: number; longest: number; lastHit: string | null };

export function streaks<T extends { date: string }>(
  rows: T[], hit: (r: T) => boolean,
): StreakInfo {
  let current = 0, longest = 0, run = 0, lastHit: string | null = null;
  for (const r of rows) {
    if (hit(r)) { run++; lastHit = r.date; if (run > longest) longest = run; }
    else run = 0;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (hit(rows[i])) current++;
    else break;
  }
  return { current, longest, lastHit };
}
