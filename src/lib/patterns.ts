import type { ISODate } from "./dates";

/* ─────────────────────────────────────────────────────────────
   Pattern insights.

   Hard rule from the spec: do not invent conclusions. So this
   engine only ever reports *observed group differences with the
   sample size attached*, never a cause. Below MIN_N per group it
   reports nothing at all and says how much data is still needed.
   ───────────────────────────────────────────────────────────── */

const MIN_N = 5;           // per side of a comparison
const MIN_DAYS = 14;       // before any insight is offered
const MIN_GAP = 0.2;       // 20 percentage points, or it isn't worth saying

export type DayFact = {
  date: ISODate;
  sleepMinutes: number | null;
  fajrOnTime: boolean | null;
  prayersOnTime: number | null;
  prayersPerformed: number | null;
  elapsedPrayers: number;
  deepWorkMinutes: number | null;
  quranPages: number | null;
  familyContact: boolean | null;
  checkedIn: boolean;
  foundationPct: number | null;
};

export type Insight = {
  key: string;
  text: string;
  strength: "observed" | "weak";
  sample: string;
};

type Split<T> = { withT: T[]; withoutT: T[] };

function split<T>(rows: T[], pred: (r: T) => boolean | null): Split<T> {
  const withT: T[] = [], withoutT: T[] = [];
  for (const r of rows) {
    const v = pred(r);
    if (v === true) withT.push(r);
    else if (v === false) withoutT.push(r);
  }
  return { withT, withoutT };
}

function rate<T>(rows: T[], pred: (r: T) => boolean | null): number | null {
  const vals = rows.map(pred).filter((v): v is boolean => v !== null);
  if (!vals.length) return null;
  return vals.filter(Boolean).length / vals.length;
}

function mean<T>(rows: T[], f: (r: T) => number | null): number | null {
  const vals = rows.map(f).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export type PatternReport = {
  ready: boolean;
  daysCollected: number;
  daysNeeded: number;
  insights: Insight[];
};

export function detectPatterns(facts: DayFact[]): PatternReport {
  const logged = facts.filter((f) => f.checkedIn);
  const out: Insight[] = [];

  if (logged.length < MIN_DAYS) {
    return {
      ready: false,
      daysCollected: logged.length,
      daysNeeded: MIN_DAYS,
      insights: [],
    };
  }

  // Sleep → Fajr punctuality. The correlation Ahmed already suspects,
  // and the one with the most leverage in his life right now.
  {
    const s = split(logged, (f) =>
      f.sleepMinutes === null ? null : f.sleepMinutes >= 360);
    if (s.withT.length >= MIN_N && s.withoutT.length >= MIN_N) {
      const a = rate(s.withT, (f) => f.fajrOnTime);
      const b = rate(s.withoutT, (f) => f.fajrOnTime);
      if (a !== null && b !== null && Math.abs(a - b) >= MIN_GAP) {
        out.push({
          key: "sleep_fajr",
          text: a > b
            ? `After 6h+ of sleep you caught Fajr on time ${pct(a)} of the time. After less than 6h, ${pct(b)}.`
            : `Fajr punctuality was ${pct(b)} on under-6h nights and ${pct(a)} on longer ones — the usual direction does not hold for you.`,
          strength: "observed",
          sample: `${s.withT.length} nights of 6h+, ${s.withoutT.length} under`,
        });
      }
    }
  }

  // Sleep → deep work.
  {
    const s = split(logged, (f) =>
      f.sleepMinutes === null ? null : f.sleepMinutes >= 360);
    if (s.withT.length >= MIN_N && s.withoutT.length >= MIN_N) {
      const a = mean(s.withT, (f) => f.deepWorkMinutes);
      const b = mean(s.withoutT, (f) => f.deepWorkMinutes);
      if (a !== null && b !== null && Math.abs(a - b) >= 30) {
        out.push({
          key: "sleep_focus",
          text: `Deep work averaged ${(a / 60).toFixed(1)}h after 6h+ sleep, versus ${(b / 60).toFixed(1)}h after short nights.`,
          strength: "observed",
          sample: `${s.withT.length} vs ${s.withoutT.length} days`,
        });
      }
    }
  }

  // Fajr → the rest of the day. Does the first prayer set the tone?
  {
    const s = split(logged, (f) => f.fajrOnTime);
    if (s.withT.length >= MIN_N && s.withoutT.length >= MIN_N) {
      const a = mean(s.withT, (f) => f.foundationPct);
      const b = mean(s.withoutT, (f) => f.foundationPct);
      if (a !== null && b !== null && Math.abs(a - b) >= MIN_GAP * 100) {
        out.push({
          key: "fajr_day",
          text: `Days that began with Fajr on time finished at ${Math.round(a)}% Foundation. Days that did not finished at ${Math.round(b)}%.`,
          strength: "observed",
          sample: `${s.withT.length} days with, ${s.withoutT.length} without`,
        });
      }
    }
  }

  // Missing the review itself → the drift the spec warns about.
  {
    const gaps: number[] = [];
    let run = 0;
    for (const f of facts) {
      if (f.checkedIn) { if (run > 0) gaps.push(run); run = 0; }
      else run++;
    }
    if (run > 0) gaps.push(run);
    const multi = gaps.filter((g) => g >= 2).length;
    if (gaps.length >= 3 && multi >= 2) {
      out.push({
        key: "review_gaps",
        text: `Of your ${gaps.length} gaps in checking in, ${multi} lasted more than a single day. A skipped day rarely stays one day.`,
        strength: "observed",
        sample: `${facts.length} days reviewed`,
      });
    }
  }

  // Qur'an consistency, stated plainly rather than scored.
  {
    const withQ = logged.filter((f) => (f.quranPages ?? 0) > 0).length;
    if (logged.length >= MIN_DAYS) {
      out.push({
        key: "quran_rate",
        text: `You opened the Qur'an on ${withQ} of the last ${logged.length} logged days (${pct(withQ / logged.length)}).`,
        strength: withQ >= 3 ? "observed" : "weak",
        sample: `${logged.length} logged days`,
      });
    }
  }

  return {
    ready: true,
    daysCollected: logged.length,
    daysNeeded: MIN_DAYS,
    insights: out,
  };
}

/** Consecutive days ending today satisfying `pred`. */
export function streak<T>(rows: T[], pred: (r: T) => boolean): number {
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (pred(rows[i])) n++;
    else break;
  }
  return n;
}
