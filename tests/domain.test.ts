/* Domain tests — the rules that decide what the app tells Ahmed
   about himself. Run: npm test */

import assert from "node:assert/strict";
import { windowsFor, deriveStatus, PRAYERS } from "../src/lib/prayer-times.ts";
import {
  TIERS, TIER_POINTS, PRAYER_TIERS, prayerTier, quantityPoints, tierPoints,
} from "../src/lib/tiers.ts";
import {
  CATEGORIES, CATEGORY_DEFS, DEEN_CEILING, computeCategory, statusFor, STATUS_LABELS,
  type CategoryInput, type CategoryKey, type CategoryScore,
} from "../src/lib/categories.ts";
import { rollUp, evaluateDay, streaks, MAJORS } from "../src/lib/scoring.ts";
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

/** All sub-habits of a category at one tier, for quick fixtures. */
function allAt(key: CategoryKey, points: number): CategoryInput {
  const p: Record<string, number | null> = {};
  for (const s of CATEGORY_DEFS[key].subs) p[s.key] = points;
  return { points: p };
}

console.log("\nThe universal tier scale");
t("six tiers, exactly as specified", () => {
  assert.deepEqual(TIERS.map((x) => [x.key, x.points]), [
    ["missed", 0], ["poor", 5], ["partial", 10],
    ["adequate", 14], ["good", 17], ["excellent", 20],
  ]);
});
t("tier points are monotonic and land inside 0–20", () => {
  const pts = TIERS.map((x) => x.points);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i] > pts[i - 1]);
  assert.equal(Math.min(...pts), 0);
  assert.equal(Math.max(...pts), 20);
});
t("an unknown tier key scores nothing rather than guessing", () => {
  assert.equal(tierPoints("splendid"), null);
  assert.equal(tierPoints(null), null);
});

console.log("\nThe prayer tier");
t("five steps, exactly as specified", () => {
  assert.deepEqual(PRAYER_TIERS.map((x) => [x.key, x.points]), [
    ["missed", 0], ["late", 8], ["on_time", 14], ["congregation", 17], ["mosque", 20],
  ]);
});
t("mosque and congregation only lift a prayer that was on time", () => {
  // Praying late at the mosque is still a late prayer.
  assert.equal(prayerTier("late", true, true, true)!.points, 8);
  assert.equal(prayerTier("on_time", true, true, true)!.points, 20);
  assert.equal(prayerTier("on_time", true, false, true)!.points, 17);
  assert.equal(prayerTier("on_time", false, false, true)!.points, 14);
});
t("an unlogged prayer is pending until its window closes, then missed", () => {
  assert.equal(prayerTier("not_logged", false, false, false), null);
  assert.equal(prayerTier("not_logged", false, false, true)!.points, 0);
});

console.log("\nQuantity habits");
t("actual over target, capped — exceeding the target is not a higher score", () => {
  assert.equal(quantityPoints(7, 7), 20);
  assert.equal(quantityPoints(14, 7), 20, "double the sleep is not double the score");
  assert.equal(quantityPoints(3.5, 7), 10);
  assert.equal(quantityPoints(0, 7), 0);
});
t("no target and no value both yield nothing rather than zero", () => {
  assert.equal(quantityPoints(null, 7), null);
  assert.equal(quantityPoints(5, 0), null);
});

console.log("\nCategory weights");
t("every category's sub-habit weights sum to 100", () => {
  for (const k of CATEGORIES) {
    const total = CATEGORY_DEFS[k].subs.reduce((a, s) => a + s.weight, 0);
    assert.equal(total, 100, `${k} weights sum to ${total}`);
  }
});
t("the specified weights are exactly what is built", () => {
  const w = (k: CategoryKey) =>
    Object.fromEntries(CATEGORY_DEFS[k].subs.map((s) => [s.key, s.weight]));
  assert.deepEqual(w("deen"), {
    fajr: 12, dhuhr: 12, asr: 12, maghrib: 12, isha: 12, quran: 20, dhikr: 10, muhasabah: 10,
  });
  assert.deepEqual(w("discipline"), {
    woke_per_plan: 15, top_priority: 25, kept_promises: 25,
    punctuality: 10, avoided_excuses: 10, difficult_task: 15,
  });
  assert.deepEqual(w("health"), {
    sleep: 30, wake_consistency: 15, exercise: 25, hygiene: 15, energy: 15,
  });
  assert.deepEqual(w("work"), { mit: 35, deep_work: 30, commitments: 20, value_created: 15 });
  assert.deepEqual(w("relationships"), {
    family_interaction: 35, responsibility: 35, friendships: 15, professional: 15,
  });
  assert.deepEqual(w("financial"), {
    no_unnecessary: 30, money_action: 30, logged: 20, debt_progress: 20,
  });
  assert.deepEqual(w("growth"), {
    learning_session: 30, applied: 40, skill_improvement: 15, project_progress: 15,
  });
});
t("application outweighs consumption in Growth", () => {
  const subs = CATEGORY_DEFS.growth.subs;
  const applied = subs.find((s) => s.key === "applied")!.weight;
  const session = subs.find((s) => s.key === "learning_session")!.weight;
  assert.ok(applied > session, "applying must be worth more than merely learning");
});
t("the five prayers carry 60% of Deen between them", () => {
  const prayers = CATEGORY_DEFS.deen.subs.filter((s) => s.input === "prayer");
  assert.equal(prayers.length, 5);
  assert.equal(prayers.reduce((a, s) => a + s.weight, 0), 60);
});

console.log("\nCategory computation");
t("a full set of Excellent taps scores 20", () => {
  const c = computeCategory("discipline", allAt("discipline", 20), true);
  assert.equal(c.score, 20);
});
t("a weighted average, not a plain one", () => {
  // top_priority (25) at Excellent, everything else Missed → 0.25 × 20 = 5.
  const input: CategoryInput = { points: {} };
  for (const s of CATEGORY_DEFS.discipline.subs) input.points[s.key] = 0;
  input.points.top_priority = 20;
  const c = computeCategory("discipline", input, true);
  assert.equal(c.score, 5, "a 25%-weight habit alone should give 5/20");
});
t("unlogged sub-habits are excluded while the day runs, counted once it closes", () => {
  const partial: CategoryInput = { points: { top_priority: 20 } };
  const open = computeCategory("discipline", partial, false);
  const closed = computeCategory("discipline", partial, true);
  assert.equal(open.score, 20, "the one thing logged is the whole average so far");
  assert.equal(closed.score, 5, "once closed, the blanks count as zero");
});
t("every sub-habit reports its own points and weight", () => {
  const c = computeCategory("health", allAt("health", 17), true);
  for (const s of c.subs) {
    assert.equal(s.points, 17);
    assert.ok(s.weight > 0);
    assert.ok(s.label.length > 0);
  }
});

console.log("\nThe Deen ceiling");
t("the ceiling table is exactly as specified", () => {
  assert.deepEqual(DEEN_CEILING, { 5: 20, 4: 16, 3: 12, 2: 8, 1: 5, 0: 3 });
});
t("voluntary worship cannot push Deen past what prayers allow", () => {
  // Every prayer missed, but Qur'an, dhikr and muhasabah all Excellent.
  const input: CategoryInput = { points: {} };
  for (const s of CATEGORY_DEFS.deen.subs) input.points[s.key] = 0;
  input.points.quran = 20;
  input.points.dhikr = 20;
  input.points.muhasabah = 20;
  const c = computeCategory("deen", input, true, 0);
  assert.equal(c.capApplied, 3, "0 prayers caps Deen at 3");
  assert.equal(c.score, 3);
  assert.ok(c.weightedScore > c.score, "the ceiling really bound");
});
t("voluntary worship still raises the score up to the ceiling", () => {
  const base: CategoryInput = { points: {} };
  for (const s of CATEGORY_DEFS.deen.subs) base.points[s.key] = 0;
  const without = computeCategory("deen", base, true, 0);

  const withQuran: CategoryInput = { points: { ...base.points, quran: 20 } };
  const lifted = computeCategory("deen", withQuran, true, 0);

  assert.ok(lifted.score > without.score,
    "reading Qur'an on a day with no prayers must still count for something");
  assert.ok(lifted.score <= 3, "but never past the ceiling");
});
t("a perfect Deen day reaches 20", () => {
  const c = computeCategory("deen", allAt("deen", 20), true, 5);
  assert.equal(c.score, 20);
  assert.equal(c.capApplied, null, "the ceiling should not bind on a complete day");
});
t("the ceiling is reported even when it is not binding", () => {
  // Showing only the binding value made the prayer log claim a ceiling
  // of 20 on a day with no prayers prayed.
  const input: CategoryInput = { points: {} };
  for (const s of CATEGORY_DEFS.deen.subs) input.points[s.key] = 0;
  const c = computeCategory("deen", input, true, 0);
  assert.equal(c.ceiling, 3, "the real ceiling at 0 prayers");
  assert.equal(c.capApplied, null, "but it is not currently binding");
});
t("the ceiling never lowers a score that is already under it", () => {
  const input: CategoryInput = { points: {} };
  for (const s of CATEGORY_DEFS.deen.subs) input.points[s.key] = 5;
  const c = computeCategory("deen", input, true, 5);
  assert.equal(c.capApplied, null);
  assert.equal(c.score, 5);
});
t("there are no deductions anywhere — nothing subtracts", () => {
  for (const k of CATEGORIES) {
    const none = computeCategory(k, allAt(k, 0), true, 0);
    assert.ok(none.score >= 0, `${k} went below zero`);
    const some = computeCategory(k, allAt(k, 10), true, 5);
    assert.ok(some.score >= none.score, `${k} scored lower with more effort`);
  }
});

console.log("\nStatus bands");
t("the bands are exactly as specified", () => {
  const cases: [number, string][] = [
    [0, "critical"], [4, "critical"], [5, "below_standard"], [9, "below_standard"],
    [10, "pass"], [12, "pass"], [13, "good"], [15, "good"],
    [16, "strong"], [18, "strong"], [19, "exceptional"], [20, "exceptional"],
  ];
  for (const [score, expected] of cases) assert.equal(statusFor(score), expected, `${score}`);
});
t("labels describe performance, never the person", () => {
  for (const label of Object.values(STATUS_LABELS)) {
    assert.ok(!/^you\b/i.test(label), `"${label}" addresses the person`);
  }
});

console.log("\nThe three headline scores");
function cats(scores: Partial<Record<CategoryKey, number>>): Record<CategoryKey, CategoryScore> {
  return Object.fromEntries(CATEGORIES.map((k) => {
    const v = scores[k] ?? 0;
    return [k, computeCategory(k, allAt(k, v), true, k === "deen" ? 5 : undefined)];
  })) as Record<CategoryKey, CategoryScore>;
}
t("each major is the plain average of its members", () => {
  const r = rollUp(cats({ deen: 20, discipline: 10, health: 0, work: 15, relationships: 15, financial: 15, growth: 12 }));
  assert.equal(r.majors.foundation.score, 10);
  assert.equal(r.majors.responsibility.score, 15);
  assert.equal(r.majors.growth.score, 12);
});
t("overall status is the WEAKEST of the three, never an average", () => {
  const r = rollUp(cats({ deen: 20, discipline: 20, health: 20, work: 20, relationships: 20, financial: 20, growth: 0 }));
  assert.equal(r.weakest.key, "growth");
  assert.equal(r.overallStatus, "critical",
    "one collapsed area must set the headline, not be averaged away");
});
t("the bottleneck category is named", () => {
  const r = rollUp(cats({ deen: 20, discipline: 20, health: 2, work: 20, relationships: 20, financial: 20, growth: 20 }));
  assert.match(r.bottleneckLine, /Health/, `got "${r.bottleneckLine}"`);
});
t("there is no merged life score anywhere", () => {
  const r = rollUp(cats({ deen: 10, discipline: 10, health: 10, work: 10, relationships: 10, financial: 10, growth: 10 }));
  assert.equal(Object.keys(r.majors).length, 3);
  assert.ok(!("overall" in r) && !("lifeScore" in r));
});

console.log("\nDay evaluation");
t("no state ever calls a day worthless", () => {
  const samples = [
    rollUp(cats({})).evaluation,
    rollUp(cats({ deen: 20, discipline: 20, health: 20, work: 20, relationships: 20, financial: 20, growth: 20 })).evaluation,
    rollUp(cats({ work: 20, relationships: 20, financial: 20 })).evaluation,
  ];
  for (const e of samples) {
    const words = (e.headline + " " + e.note).toLowerCase();
    for (const bad of ["worthless", "failure", "failed", "pathetic", "lazy", "shame"]) {
      assert.ok(!words.includes(bad), `must not say "${bad}" — got: ${e.headline}`);
    }
  }
});
t("strong work never rescues a collapsed foundation", () => {
  const r = rollUp(cats({ work: 20, relationships: 20, financial: 20 }));
  assert.equal(r.evaluation.state, "responsibility_only");
  assert.ok(r.evaluation.suggestReset);
});
t("reset is suggested, never forced, and not on a merely quiet day", () => {
  const held = rollUp(cats({ deen: 16, discipline: 14, health: 14 }));
  assert.equal(held.evaluation.suggestReset, false);
});

console.log("\nPrayer windows");
t("five windows, strictly increasing", () => {
  const w = windowsFor("2026-08-28", TETOUAN);
  assert.equal(w.length, 5);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start > w[i - 1].start);
});
t("each window ends when the next prayer enters", () => {
  const w = windowsFor("2026-08-28", TETOUAN);
  for (let i = 0; i < 4; i++) assert.equal(+w[i].end, +w[i + 1].start);
});
const W = windowsFor("2026-08-28", TETOUAN)[1];
t("inside the window is on time; past it is late, not missed", () => {
  assert.equal(deriveStatus(W, new Date(+W.start + 600_000), new Date(+W.start + 600_000)), "on_time");
  assert.equal(deriveStatus(W, new Date(+W.onTimeUntil + 60_000), new Date(+W.onTimeUntil + 60_000)), "late");
});
t("unprayed with the window still open is late, never missed", () => {
  assert.equal(deriveStatus(W, null, new Date(+W.start + 5_400_000)), "late");
  assert.equal(deriveStatus(W, null, new Date(+W.end + 60_000)), "missed");
});

console.log("\nStreaks");
t("current and longest are tracked apart", () => {
  const rows = [
    { date: "a", hit: true }, { date: "b", hit: true }, { date: "c", hit: true },
    { date: "d", hit: false }, { date: "e", hit: true },
  ];
  const s = streaks(rows, (r) => r.hit);
  assert.equal(s.current, 1);
  assert.equal(s.longest, 3, "a missed day must never erase the longest run");
});

console.log("\nDates");
t("today resolves in the user's timezone, not the server's", () => {
  const at = new Date("2026-08-28T23:30:00Z");
  assert.equal(todayIn("Africa/Casablanca", at), "2026-08-29");
  assert.equal(todayIn("America/New_York", at), "2026-08-28");
});
t("date arithmetic crosses months and years", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-01-01", "2026-03-01"), 59);
});
t("the review week ends on Friday", () => {
  assert.equal(weekStart("2026-08-28", 5), "2026-08-22");
  assert.equal(weekStart("2026-08-29", 5), "2026-08-29");
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
