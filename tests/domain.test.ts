/* Domain tests — the rules that decide what the app tells Ahmed
   about himself. Run: npm test */

import assert from "node:assert/strict";
import { windowsFor, deriveStatus, PRAYERS } from "../src/lib/prayer-times.ts";
import {
  rollUpDay, evaluateDay, streaks, derivedShares, DEFAULT_SCORING,
  type ScoringSettings,
} from "../src/lib/scoring.ts";
import {
  allCategories, computeCategoryPct, CATEGORIES,
  deenCategory, disciplineCategory, growthCategory, workCategory, healthCategory,
  type ScoringInputs,
} from "../src/lib/categories.ts";
import { detectPatterns, type DayFact } from "../src/lib/patterns.ts";
import { todayIn, addDays, weekStart, daysBetween } from "../src/lib/dates.ts";

let pass = 0, fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e: any) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

const TETOUAN = {
  latitude: 35.5785, longitude: -5.3684, timezone: "Africa/Casablanca",
  fajrAngle: 19, ishaAngle: 17, madhab: "Shafi", onTimeWindowMinutes: 30,
};

const S: ScoringSettings = DEFAULT_SCORING;

const base: ScoringInputs = {
  finalized: true,
  prayersCompleted: 0, prayersOnTime: 0, prayersInCongregation: 0, elapsedPrayers: 5,
  quranPages: null, quranGoalPages: 1, dhikrDone: null, muhasabahDone: false,
  promisesMade: 0, promisesKept: 0,
  scheduledEvents: null, onTimeEvents: null,
  excusesLogged: null, avoidanceFlags: null,
  mostImportantTaskSet: false, mostImportantTaskDone: null,
  deepWorkMinutes: null, deepWorkTargetMinutes: 120,
  commitmentsDue: 0, commitmentsMet: 0,
  sleepMinutes: null, sleepGoalHours: 7, wakeDeviationMinutes: null,
  exerciseDone: null, hygieneDone: null,
  interactionLogged: null, responsibilityDone: null,
  unnecessaryTxns: null, plannedActionTaken: null,
  learningMinutes: null, hasAppliedNote: null,
  weeklyActivityCount: null, weeklyTarget: 5,
};

/** A day with nothing logged, still in progress — the shape used to
 *  check that blanks are excluded rather than counted as zero. */
const open: ScoringInputs = { ...base, finalized: false };

const perfectDeen: Partial<ScoringInputs> = {
  prayersCompleted: 5, prayersOnTime: 5, prayersInCongregation: 5,
  quranPages: 2, dhikrDone: true, muhasabahDone: true,
};
const perfectRest: Partial<ScoringInputs> = {
  promisesMade: 2, promisesKept: 2,
  scheduledEvents: 2, onTimeEvents: 2, excusesLogged: 0, avoidanceFlags: 0,
  mostImportantTaskSet: true, mostImportantTaskDone: true, deepWorkMinutes: 180,
  commitmentsDue: 1, commitmentsMet: 1,
  sleepMinutes: 480, wakeDeviationMinutes: 0, exerciseDone: true, hygieneDone: true,
  interactionLogged: true, responsibilityDone: true,
  unnecessaryTxns: 0, plannedActionTaken: true,
  learningMinutes: 60, hasAppliedNote: true,
  weeklyActivityCount: 5,
};

console.log("\nPrayer windows");
t("five windows, strictly increasing", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  assert.equal(w.length, 5);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start > w[i - 1].start);
});
t("each window ends when the next prayer enters", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  for (let i = 0; i < 4; i++) assert.equal(+w[i].end, +w[i + 1].start);
});
t("Isha runs through to the next Fajr", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  assert.ok(w[4].end > w[4].start);
  assert.ok(w[4].end.getTime() - w[4].start.getTime() < 12 * 3600_000);
});
t("on-time window honours the configured length", () => {
  const a = windowsFor("2026-08-26", TETOUAN);
  const b = windowsFor("2026-08-26", { ...TETOUAN, onTimeWindowMinutes: 45 });
  assert.equal(a[0].onTimeUntil.getTime() - a[0].start.getTime(), 30 * 60_000);
  assert.equal(b[0].onTimeUntil.getTime() - b[0].start.getTime(), 45 * 60_000);
});

console.log("\nPunctuality");
const W = windowsFor("2026-08-26", TETOUAN)[1];
t("inside the window is on time", () =>
  assert.equal(deriveStatus(W, new Date(+W.start + 600_000), new Date(+W.start + 600_000)), "on_time"));
t("one minute past the window is late, not missed", () =>
  assert.equal(deriveStatus(W, new Date(+W.onTimeUntil + 60_000), new Date(+W.onTimeUntil + 60_000)), "late"));
t("unprayed but window still open is late, never missed", () =>
  assert.equal(deriveStatus(W, null, new Date(+W.start + 5_400_000)), "late"));
t("unprayed after the window closes is missed", () =>
  assert.equal(deriveStatus(W, null, new Date(+W.end + 60_000)), "missed"));
t("before the prayer enters it is 'not yet', not a failure", () =>
  assert.equal(deriveStatus(W, null, new Date(+W.start - 60_000)), "not_yet"));

console.log("\nCategory scoring (§3.1 sub-weights)");
t("sub-weights match the specification exactly", () => {
  const spec: Record<string, Record<string, number>> = {
    deen: { prayers_completed: 30, prayers_on_time: 25, congregation: 10, quran: 20, dhikr_muhasabah: 15 },
    discipline: { promises: 40, punctuality: 25, excuse_free: 20, procrastination_free: 15 },
    work: { most_important: 40, deep_work: 30, commitments: 30 },
    health: { sleep: 35, wake_consistency: 15, movement: 25, hygiene: 25 },
    family: { interaction: 60, responsibility: 40 },
    financial: { no_unnecessary: 50, planned_action: 50 },
    growth: { session: 40, applied: 60 },
    business: { weekly_activity: 100 },
  };
  const cats = allCategories(base);
  for (const [key, subs] of Object.entries(spec)) {
    const got = Object.fromEntries((cats as any)[key].subs.map((x: any) => [x.key, x.weight]));
    assert.deepEqual(got, subs, `${key} sub-weights`);
    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    assert.equal(total, 100, `${key} sub-weights must sum to 100`);
  }
});
t("every category is a pure function via computeCategoryPct", () => {
  for (const k of CATEGORIES) {
    const a = computeCategoryPct(k, { ...base, ...perfectDeen, ...perfectRest });
    const b = computeCategoryPct(k, { ...base, ...perfectDeen, ...perfectRest });
    assert.equal(a, b, `${k} must be deterministic`);
    assert.equal(a, 100, `${k} should be full on a perfect day`);
  }
});
t("an unlogged category is null while the day runs, never zero", () => {
  const c = allCategories(open);
  assert.equal(c.family.pct, null, "family with nothing logged must be null");
  assert.equal(c.financial.pct, null);
});
t("not-applicable is skipped, not scored zero", () => {
  // No promises due and nothing scheduled: Discipline must rest on
  // the two metrics that do apply, not be dragged down by absence.
  const d = disciplineCategory({ ...base, excusesLogged: 0, avoidanceFlags: 0 });
  assert.equal(d.subs.find((s) => s.key === "promises")!.applicable, false);
  assert.equal(d.subs.find((s) => s.key === "punctuality")!.applicable, false);
  assert.equal(d.pct, 100, "renormalised over the applicable metrics");
});
t("praying late still earns the obligation but not the punctuality", () => {
  const d = deenCategory({ ...base, prayersCompleted: 5, prayersOnTime: 0 });
  assert.equal(d.subs.find((s) => s.key === "prayers_completed")!.value, 1);
  assert.equal(d.subs.find((s) => s.key === "prayers_on_time")!.value, 0);
});
t("obligatory prayer metrics outweigh every optional one in Deen", () => {
  const d = deenCategory({ ...base, ...perfectDeen });
  const oblig = d.subs.filter((s) => s.obligatory).reduce((a, s) => a + s.weight, 0);
  assert.equal(oblig, 55, "prayers completed + on time carry the majority");
  assert.ok(oblig > 50, "obligation must outweigh everything optional combined");
});
t("congregation cannot compensate for a missed prayer", () => {
  const prayed = deenCategory({ ...base, prayersCompleted: 5, prayersOnTime: 5, prayersInCongregation: 0 });
  const skipped = deenCategory({ ...base, prayersCompleted: 0, prayersOnTime: 0, prayersInCongregation: 0 });
  assert.ok(prayed.pct! - skipped.pct! >= 55, "the obligation dominates");
});
t("Qur'an is proportional to the goal", () => {
  assert.equal(deenCategory({ ...base, quranPages: 1, quranGoalPages: 2 })
    .subs.find((s) => s.key === "quran")!.value, 0.5);
  assert.equal(deenCategory({ ...base, quranPages: 4, quranGoalPages: 2 })
    .subs.find((s) => s.key === "quran")!.value, 1, "capped at the goal");
});
t("Muhasabah scores completion only, never content", () => {
  const d = deenCategory({ ...base, muhasabahDone: true, dhikrDone: true });
  const m = d.subs.find((s) => s.key === "dhikr_muhasabah")!;
  assert.equal(m.value, 1);
  assert.ok(!/content|wrote|text|said/i.test(m.detail));
});
t("excuses subtract 20 each, avoidance 25 each, both floored at zero", () => {
  const one = disciplineCategory({ ...base, excusesLogged: 1, avoidanceFlags: 1 });
  assert.equal(one.subs.find((s) => s.key === "excuse_free")!.value, 0.8);
  assert.equal(one.subs.find((s) => s.key === "procrastination_free")!.value, 0.75);
  const many = disciplineCategory({ ...base, excusesLogged: 9, avoidanceFlags: 9 });
  assert.equal(many.subs.find((s) => s.key === "excuse_free")!.value, 0);
  assert.equal(many.subs.find((s) => s.key === "procrastination_free")!.value, 0,
    "floors at zero rather than going negative");
});
t("learning without application caps Growth at exactly 40%", () => {
  const notApplied = growthCategory({ ...base, learningMinutes: 180, hasAppliedNote: false });
  const applied = growthCategory({ ...base, learningMinutes: 30, hasAppliedNote: true });
  assert.equal(notApplied.pct, 40, "three hours unapplied is still 40%");
  assert.equal(applied.pct, 100, "half an hour applied beats it outright");
});
t("work measures value, not hours at a desk", () => {
  const subs = workCategory({ ...base, mostImportantTaskSet: true, mostImportantTaskDone: true }).subs;
  assert.ok(!subs.some((s) => /hours worked|total hours|time at/i.test(s.label)),
    "raw hours must not be a work sub-metric");
});
t("sleep is capped — more than the target is not a higher score", () => {
  const onTarget = healthCategory({ ...base, sleepMinutes: 420 });
  const oversleep = healthCategory({ ...base, sleepMinutes: 720 });
  assert.equal(onTarget.subs.find((s) => s.key === "sleep")!.value, 1);
  assert.equal(oversleep.subs.find((s) => s.key === "sleep")!.value, 1);
});
t("wake consistency is full within 30 min, then decays to zero at two hours", () => {
  const at = (d: number) => healthCategory({ ...base, wakeDeviationMinutes: d })
    .subs.find((s) => s.key === "wake_consistency")!.value;
  assert.equal(at(0), 1);
  assert.equal(at(30), 1, "the +/-30 min band is full marks");
  assert.equal(at(75), 0.5);
  assert.equal(at(120), 0);
  assert.equal(at(240), 0, "floored, never negative");
});
t("morning is not scored as failure", () => {
  const morning = deenCategory({
    ...open, elapsedPrayers: 1, prayersCompleted: 1, prayersOnTime: 1, prayersInCongregation: 1,
  });
  assert.equal(morning.subs.find((s) => s.key === "prayers_completed")!.value, 1,
    "one of one prayed is full marks so far");
});
t("a closed day divides prayers by five, as specified", () => {
  const closed = deenCategory({ ...base, finalized: true, elapsedPrayers: 1, prayersCompleted: 1 });
  assert.equal(closed.subs.find((s) => s.key === "prayers_completed")!.value, 0.2);
});
t("every sub-metric explains its own number", () => {
  const cats = allCategories({ ...base, ...perfectDeen, ...perfectRest });
  for (const c of Object.values(cats))
    for (const s of c.subs)
      assert.ok(s.detail && s.detail.length > 0, `${c.key}.${s.key} must justify itself`);
});

console.log("\nThe Foundation gate");
const SH = derivedShares(S.weights);
function overallFor(F: number, L: number) {
  // Drive the roll-up directly at the arithmetic it performs. The shares
  // come from the weights themselves — there is no second knob.
  return Math.min(F * SH.foundationShare + L * SH.lifeShare, F + S.gateCapOffset);
}
t("a perfect day still reaches 100", () => {
  const r = rollUpDay({ ...base, ...perfectDeen, ...perfectRest }, S, true);
  assert.equal(r.foundation.pct, 100);
  assert.equal(r.life.pct, 100);
  assert.equal(r.overallPct, 100, "the cap must not punish a complete day");
});
t("collapsed foundation caps a productive day", () => {
  // A genuinely collapsed foundation: Deen, Discipline and Health all down,
  // with Work/Family/Money/Growth/Business all perfect.
  const r = rollUpDay({ ...base, ...perfectRest,
    prayersCompleted: 0, prayersOnTime: 0, prayersInCongregation: 0, quranPages: 0,
    dhikrDone: false, muhasabahDone: false,
    promisesMade: 2, promisesKept: 0,
    scheduledEvents: 2, onTimeEvents: 0, excusesLogged: 5, avoidanceFlags: 4,
    sleepMinutes: 0, wakeDeviationMinutes: 120, exerciseDone: false, hygieneDone: false,
  }, S, true);
  assert.ok(r.gated, "the ceiling should bind");
  assert.ok(r.overallPct! < r.ungatedPct!, "gated must be below the plain blend");
  assert.equal(r.overallPct, Math.round((r.foundation.pct! + 15) * 100) / 100);
});
t("missing every prayer alone does not cap the day — Discipline and Health still count", () => {
  // Documents the sensitivity of the gate under global weights. With
  // Foundation at 75% of the day, zeroing Deen leaves Foundation near 53%,
  // which is not the productive-but-collapsed shape the ceiling is for.
  // If this should cap, the lever is gateCapOffset, not a second blend.
  const r = rollUpDay({ ...base, ...perfectRest, prayersCompleted: 0, prayersOnTime: 0,
    prayersInCongregation: 0, quranPages: 0, dhikrDone: false, muhasabahDone: false }, S, true);
  assert.ok(!r.gated, "the ceiling should not bind on a partial foundation");
  assert.ok(r.foundation.pct! > 45 && r.foundation.pct! < 60,
    `expected Foundation in the 45–60 band, got ${r.foundation.pct}`);
  assert.equal(r.evaluation.state, "slipping",
    "it should still be named as slipping, even though the cap did not bind");
});
t("the gate is continuous — no cliff anywhere", () => {
  // The bug in the original spec: `if (F < 40)` made Overall jump.
  for (const L of [0, 25, 50, 75, 90, 100]) {
    let prev = overallFor(0, L);
    for (let F = 0.5; F <= 100; F += 0.5) {
      const cur = overallFor(F, L);
      assert.ok(Math.abs(cur - prev) < 1.0,
        `jump of ${(cur - prev).toFixed(2)} at F=${F}, L=${L}`);
      prev = cur;
    }
  }
});
t("the gate binds exactly when Life exceeds Foundation by offset/lifeShare", () => {
  // Cap binds when F*fShare + L*lShare > F + offset
  //            <=> L > F + offset/lShare   = F + 60 at the default weights
  const gap = S.gateCapOffset / SH.lifeShare;
  assert.ok(Math.abs(gap - 60) < 1e-9, `expected 60, got ${gap}`);
  for (const F of [0, 20, 40, 60, 80]) {
    const justUnder = overallFor(F, F + gap - 1);
    const justOver = overallFor(F, F + gap + 1);
    assert.ok(Math.abs(justUnder - (F * SH.foundationShare + (F + gap - 1) * SH.lifeShare)) < 1e-9,
      `below the crossover the blend should win at F=${F}`);
    assert.ok(Math.abs(justOver - Math.min(F + S.gateCapOffset,
      F * SH.foundationShare + (F + gap + 1) * SH.lifeShare)) < 1e-9);
  }
  // At the crossover the two branches agree — which is why it is smooth.
  const F = 40, Lcross = F + gap;
  assert.ok(Math.abs((F * SH.foundationShare + Lcross * SH.lifeShare) - (F + S.gateCapOffset)) < 1e-9);
});

/* ── Regression: the weights you configure are the weights applied.
      A previous revision normalised weights inside Foundation and inside
      Life, then blended the two groups 0.6/0.4. Both halves looked
      right in isolation; together they turned Deen 35 / Work 15 into an
      effective 28 / 24 and quietly put Work above Deen. ── */
t("the configured weights are the weights actually applied", () => {
  const r = rollUpDay({ ...base, ...perfectDeen, ...perfectRest }, S, true);
  let num = 0, den = 0;
  for (const k of Object.keys(r.categories) as (keyof typeof r.categories)[]) {
    const pct = r.categories[k].pct;
    if (pct === null) continue;
    num += pct * S.weights[k];
    den += S.weights[k];
  }
  const expected = Math.round((num / den) * 100) / 100;
  assert.ok(Math.abs(r.ungatedPct! - expected) < 0.011,
    `Overall ${r.ungatedPct} should equal the direct global weighted mean ${expected}`);
});
t("Deen outweighs Work in the Overall figure, as configured", () => {
  // 35 vs 15 in the config must survive the roll-up rather than being
  // inverted by a second group-level blend.
  const eff = (k: "deen" | "work") =>
    S.weights[k] / Object.values(S.weights).reduce((a, b) => a + b, 0);
  assert.ok(eff("deen") > eff("work"),
    "Deen must carry more of the day than Work");
  assert.ok(Math.abs(SH.foundationShare - 0.75) < 1e-9,
    `Foundation should carry 75% at the default weights, got ${SH.foundationShare}`);
});
t("the two panels on screen reconcile with the Overall figure", () => {
  const r = rollUpDay({ ...base, ...perfectDeen, ...perfectRest }, S, true);
  const blended = (r.foundation.pct! * r.foundation.countedWeight
                 + r.life.pct! * r.life.countedWeight)
                 / (r.foundation.countedWeight + r.life.countedWeight);
  assert.ok(Math.abs(r.ungatedPct! - Math.round(blended * 100) / 100) < 0.011,
    "Foundation and Life must add up to Overall, not merely gesture at it");
});
t("Overall is never a plain average of the two scores", () => {
  const F = 20, L = 100;
  assert.notEqual(overallFor(F, L), (F + L) / 2);
  assert.ok(overallFor(F, L) < (F + L) / 2, "the gate must pull it below the midpoint");
});
t("a blank category counts as zero once the day is closed", () => {
  const running = rollUpDay({ ...open, ...perfectDeen }, S);
  const closed = rollUpDay({ ...base, ...perfectDeen }, S);
  assert.equal(running.life.pct, null, "an unfinished day excludes blanks");
  assert.equal(closed.life.pct, 0, "a closed day counts them as zero");
});
t("finalized has one source of truth", () => {
  // The override and the input must not be able to disagree.
  const viaInput = rollUpDay({ ...open, ...perfectDeen }, S);
  const viaOverride = rollUpDay({ ...base, ...perfectDeen }, S, false);
  assert.equal(viaInput.life.pct, viaOverride.life.pct);
  assert.equal(viaInput.foundation.pct, viaOverride.foundation.pct);
});
t("morning is not scored as failure", () => {
  const r = rollUpDay({ ...open, elapsedPrayers: 1, prayersCompleted: 1, prayersOnTime: 1 }, S, false);
  assert.equal(r.categories.deen.subs.find((s) => s.key === "prayers_completed")!.value, 1);
});

console.log("\nDay evaluation");
t("no state ever calls a day worthless", () => {
  const states = [
    evaluateDay(0, 0, 0, false, 15, 5), evaluateDay(20, 90, 35, true, 35, 5),
    evaluateDay(50, 50, 50, false, 65, 5), evaluateDay(90, 90, 90, false, 105, 5),
    evaluateDay(0, 0, 0, false, 15, 1),
  ];
  for (const e of states) {
    const words = (e.headline + " " + e.note).toLowerCase();
    for (const bad of ["worthless", "failure", "failed", "pathetic", "lazy", "shame"])
      assert.ok(!words.includes(bad), `must not say "${bad}" — got: ${e.headline}`);
  }
});
t("strong work never rescues a broken foundation", () => {
  const e = evaluateDay(20, 95, 35, true, 35, 5);
  assert.equal(e.state, "growth_only");
  assert.ok(e.suggestReset);
});
t("foundation held with quiet growth is not a bad day", () => {
  const e = evaluateDay(85, 20, 59, false, 100, 5);
  assert.equal(e.state, "foundation_held");
  assert.equal(e.suggestReset, false);
});
t("early morning with nothing logged is 'still ahead of you'", () => {
  const e = evaluateDay(0, 0, 0, false, 15, 1);
  assert.equal(e.state, "early");
  assert.equal(e.suggestReset, false);
});

console.log("\nStreaks");
t("current and longest are tracked separately", () => {
  const rows = [
    { date: "d1", hit: true }, { date: "d2", hit: true }, { date: "d3", hit: true },
    { date: "d4", hit: false }, { date: "d5", hit: true },
  ];
  const s = streaks(rows, (r) => r.hit);
  assert.equal(s.current, 1, "current reflects the run ending today");
  assert.equal(s.longest, 3, "longest survives the gap — what happened, happened");
});
t("a missed day never erases the longest streak", () => {
  const rows = [{ date: "a", hit: true }, { date: "b", hit: true }, { date: "c", hit: false }];
  const s = streaks(rows, (r) => r.hit);
  assert.equal(s.current, 0);
  assert.equal(s.longest, 2);
});

console.log("\nPattern gate");
function fact(i: number, o: Partial<DayFact> = {}): DayFact {
  return {
    date: addDays("2026-01-01", i), sleepMinutes: null, fajrOnTime: null,
    prayersOnTime: null, prayersPerformed: null, elapsedPrayers: 5,
    deepWorkMinutes: null, quranPages: null, familyContact: null,
    checkedIn: true, foundationPct: null, ...o,
  };
}
t("says nothing at all below the day threshold", () => {
  const r = detectPatterns(Array.from({ length: 10 }, (_, i) => fact(i)));
  assert.equal(r.ready, false);
  assert.equal(r.insights.length, 0);
});
t("unlogged days do not count toward the threshold", () => {
  const r = detectPatterns(Array.from({ length: 30 }, (_, i) => fact(i, { checkedIn: false })));
  assert.equal(r.ready, false);
  assert.equal(r.daysCollected, 0);
});
t("a real sleep/Fajr split is reported with its sample size", () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => fact(i, { sleepMinutes: 450, fajrOnTime: true })),
    ...Array.from({ length: 8 }, (_, i) => fact(i + 8, { sleepMinutes: 260, fajrOnTime: false })),
  ];
  const s = detectPatterns(rows).insights.find((x) => x.key === "sleep_fajr");
  assert.ok(s, "expected the sleep/Fajr comparison");
  assert.match(s!.sample, /\d+ nights of 6h\+/);
});
t("a group with too few days is not reported", () => {
  const rows = [
    ...Array.from({ length: 16 }, (_, i) => fact(i, { sleepMinutes: 450, fajrOnTime: true })),
    ...Array.from({ length: 2 }, (_, i) => fact(i + 16, { sleepMinutes: 260, fajrOnTime: false })),
  ];
  assert.equal(detectPatterns(rows).insights.find((x) => x.key === "sleep_fajr"), undefined);
});
t("insights never assert causation", () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => fact(i, { sleepMinutes: 450, fajrOnTime: true, foundationPct: 90 })),
    ...Array.from({ length: 8 }, (_, i) => fact(i + 8, { sleepMinutes: 260, fajrOnTime: false, foundationPct: 30 })),
  ];
  for (const i of detectPatterns(rows).insights)
    for (const w of ["because", "causes", "caused by", "due to", "proves"])
      assert.ok(!i.text.toLowerCase().includes(w), `"${w}" claims cause: ${i.text}`);
});

console.log("\nDates");
t("today is resolved in the user's timezone, not the server's", () => {
  const at = new Date("2026-08-26T23:30:00Z");
  assert.equal(todayIn("Africa/Casablanca", at), "2026-08-27");
  assert.equal(todayIn("America/New_York", at), "2026-08-26");
});
t("date arithmetic crosses months and years", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-01-01", "2026-03-01"), 59);
});
t("the review week ends on Friday", () => {
  assert.equal(weekStart("2026-08-26", 5), "2026-08-22");
  assert.equal(weekStart("2026-08-28", 5), "2026-08-22");
  assert.equal(weekStart("2026-08-29", 5), "2026-08-29");
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
