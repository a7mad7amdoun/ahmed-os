import type { PrayerKey } from "./prayer-times";

/* ─────────────────────────────────────────────────────────────
   Two scores. Never averaged into one number, never secretly
   weighted. Every component reports what it gave, out of what,
   and why — so the score can always be argued with.

   Rule the UI enforces: Life Progress cannot repair Foundation.
   ───────────────────────────────────────────────────────────── */

export type Component = {
  key: string;
  label: string;
  earned: number;
  max: number;
  /** Plain-language account of how `earned` was reached. */
  detail: string;
  /** True when nothing has been logged yet — shown as "—", not as 0. */
  unlogged?: boolean;
};

export type Score = {
  total: number;
  max: number;
  components: Component[];
};

export type PrayerRow = {
  prayer: PrayerKey;
  status: "not_logged" | "on_time" | "late" | "missed";
};

export type DayInput = {
  prayers: PrayerRow[];
  /** Prayers whose time has entered. Caps the max so a 9am score
   *  isn't a punishment for the day not being over. */
  elapsedPrayers: number;
  quranPages: number | null;
  quranGoalPages: number;
  keptPromises: boolean | null;
  wasHonest: boolean | null;
  madeExcuses: boolean | null;
  sleepMinutes: number | null;
  sleepGoalHours: number;
  hygiene: boolean | null;
  movement: boolean | null;
  topPriority: string | null;
  topPriorityDone: boolean | null;
  deepWorkMinutes: number | null;
  valueCreated: string | null;
  learningMinutes: number | null;
  learningApplied: boolean | null;
  familyContact: boolean | null;
  familyResponsibility: boolean | null;
  unnecessarySpend: number | null;
  spendLogged: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function foundationScore(d: DayInput): Score {
  const c: Component[] = [];
  const elapsed = Math.max(0, Math.min(5, d.elapsedPrayers));

  // 1. The obligation itself — 7 points, the largest single block.
  const performed = d.prayers.filter(
    (p) => p.status === "on_time" || p.status === "late",
  ).length;
  const prayMax = elapsed === 0 ? 0 : r1((7 * elapsed) / 5);
  c.push({
    key: "prayers",
    label: "Obligatory prayers",
    earned: elapsed === 0 ? 0 : r1((7 * performed) / 5),
    max: prayMax,
    detail: `${performed} of ${elapsed} prayed`,
    unlogged: elapsed > 0 && d.prayers.every((p) => p.status === "not_logged"),
  });

  // 2. Punctuality — real, because it is measured against real times.
  const onTime = d.prayers.filter((p) => p.status === "on_time").length;
  c.push({
    key: "punctuality",
    label: "Prayed on time",
    earned: elapsed === 0 ? 0 : r1((4 * onTime) / 5),
    max: elapsed === 0 ? 0 : r1((4 * elapsed) / 5),
    detail: `${onTime} of ${elapsed} within the window`,
  });

  // 3. Qur'an — contact matters more than volume at this stage.
  const pages = d.quranPages ?? 0;
  const quran = pages <= 0 ? 0 : pages >= d.quranGoalPages ? 3 : 2;
  c.push({
    key: "quran",
    label: "Qur'an · القرآن",
    earned: quran,
    max: 3,
    detail: pages <= 0
      ? "Not opened today"
      : pages >= d.quranGoalPages
        ? `${pages} page${pages === 1 ? "" : "s"} — goal met`
        : `${pages} page${pages === 1 ? "" : "s"} — opened, below goal`,
    unlogged: d.quranPages === null,
  });

  // 4. Integrity. Self-reported, and the app says so.
  let integrity = 0;
  const bits: string[] = [];
  if (d.keptPromises) { integrity += 1.5; bits.push("kept promises"); }
  if (d.wasHonest) { integrity += 1; bits.push("honest"); }
  if (d.madeExcuses === false) { integrity += 0.5; bits.push("no excuses"); }
  c.push({
    key: "integrity",
    label: "Integrity & discipline",
    earned: r1(integrity),
    max: 3,
    detail: bits.length ? bits.join(", ") : "Nothing marked",
    unlogged: d.keptPromises === null && d.wasHonest === null,
  });

  // 5. Basic health — the floor, not a fitness programme.
  let health = 0;
  const hbits: string[] = [];
  if (d.sleepMinutes !== null) {
    const h = d.sleepMinutes / 60;
    if (h >= d.sleepGoalHours - 1 && h <= d.sleepGoalHours + 2) {
      health += 2; hbits.push(`${h.toFixed(1)}h sleep`);
    } else if (h >= 5) {
      health += 1; hbits.push(`${h.toFixed(1)}h sleep — short`);
    } else {
      hbits.push(`${h.toFixed(1)}h sleep — too little`);
    }
  }
  if (d.hygiene) { health += 1; hbits.push("hygiene"); }
  c.push({
    key: "health",
    label: "Basic health",
    earned: r1(health),
    max: 3,
    detail: hbits.length ? hbits.join(", ") : "Nothing logged",
    unlogged: d.sleepMinutes === null && d.hygiene === null,
  });

  const max = c.reduce((s, x) => s + x.max, 0);
  const total = c.reduce((s, x) => s + x.earned, 0);
  return { total: r1(total), max: r1(max), components: c };
}

export function lifeProgressScore(d: DayInput): Score {
  const c: Component[] = [];

  // Hours worked ≠ value created. The single most important task
  // outweighs raw time, deliberately.
  c.push({
    key: "priority",
    label: "Most important task",
    earned: d.topPriorityDone ? 4 : 0,
    max: 4,
    detail: !d.topPriority
      ? "No priority set"
      : d.topPriorityDone ? "Completed" : "Set, not completed",
    unlogged: !d.topPriority,
  });

  const dw = d.deepWorkMinutes ?? 0;
  c.push({
    key: "deepwork",
    label: "Deep work",
    earned: dw >= 120 ? 3 : dw >= 60 ? 1.5 : 0,
    max: 3,
    detail: d.deepWorkMinutes === null
      ? "Not logged"
      : `${(dw / 60).toFixed(1)}h focused`,
    unlogged: d.deepWorkMinutes === null,
  });

  c.push({
    key: "value",
    label: "Value created",
    earned: d.valueCreated && d.valueCreated.trim().length > 0 ? 2 : 0,
    max: 2,
    detail: d.valueCreated?.trim() ? "Named something delivered" : "Nothing named",
    unlogged: d.valueCreated === null,
  });

  // Learning only counts halfway until it is applied — the guard
  // against productive procrastination.
  const lm = d.learningMinutes ?? 0;
  let learn = 0;
  if (lm >= 30) learn += 2; else if (lm > 0) learn += 1;
  if (d.learningApplied) learn += 2;
  c.push({
    key: "learning",
    label: "Learning applied",
    earned: r1(learn),
    max: 4,
    detail: lm === 0
      ? "No learning logged"
      : d.learningApplied
        ? `${lm}min — and used it`
        : `${lm}min — not yet applied`,
    unlogged: d.learningMinutes === null,
  });

  let fam = 0;
  const fbits: string[] = [];
  if (d.familyContact) { fam += 2; fbits.push("real interaction"); }
  if (d.familyResponsibility) { fam += 2; fbits.push("responsibility met"); }
  c.push({
    key: "family",
    label: "Family · الأهل",
    earned: fam,
    max: 4,
    detail: fbits.length ? fbits.join(", ") : "Nothing logged",
    unlogged: d.familyContact === null && d.familyResponsibility === null,
  });

  const spend = d.unnecessarySpend ?? 0;
  c.push({
    key: "money",
    label: "Financial discipline",
    earned: !d.spendLogged ? 0 : spend === 0 ? 3 : spend < 50 ? 1.5 : 0,
    max: 3,
    detail: !d.spendLogged
      ? "Not logged"
      : spend === 0 ? "No unnecessary spending" : `${spend} MAD unnecessary`,
    unlogged: !d.spendLogged,
  });

  const max = c.reduce((s, x) => s + x.max, 0);
  const total = c.reduce((s, x) => s + x.earned, 0);
  return { total: r1(total), max: r1(max), components: c };
}

/* ─────────────────────────────────────────────────────────────
   The verdict is a state, not an average. No day is ever called
   worthless, and no amount of work redeems a broken foundation.
   ───────────────────────────────────────────────────────────── */

export type DayState =
  | "strong" | "foundation_held" | "growth_only" | "slipping" | "broken" | "early";

export type Evaluation = {
  state: DayState;
  headline: string;
  note: string;
  /** Whether the dashboard should surface the Reset Protocol. */
  suggestReset: boolean;
};

export function evaluateDay(f: Score, l: Score, elapsedPrayers: number): Evaluation {
  const fPct = f.max > 0 ? f.total / f.max : 0;
  const lPct = l.max > 0 ? l.total / l.max : 0;

  if (elapsedPrayers <= 1 && f.total === 0) {
    return {
      state: "early",
      headline: "The day is still ahead of you",
      note: "Nothing is decided yet.",
      suggestReset: false,
    };
  }
  if (fPct >= 0.7 && lPct >= 0.6) {
    return {
      state: "strong",
      headline: "Foundation held, and you moved forward",
      note: "This is the shape of a good day. Repeat it tomorrow.",
      suggestReset: false,
    };
  }
  if (fPct >= 0.7) {
    return {
      state: "foundation_held",
      headline: "Foundation held",
      note: "Growth was quiet today. That is a far smaller problem than the reverse.",
      suggestReset: false,
    };
  }
  if (lPct >= 0.6 && fPct < 0.5) {
    return {
      state: "growth_only",
      headline: "Productive, but the foundation slipped",
      note: "Work went well. It does not cover what was missed underneath.",
      suggestReset: true,
    };
  }
  if (fPct >= 0.4) {
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
