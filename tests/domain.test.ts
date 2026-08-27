/* Domain tests — the rules that decide what the app tells Ahmed
   about himself. Run: npm test */

import assert from "node:assert/strict";
import { windowsFor, deriveStatus, PRAYERS } from "../src/lib/prayer-times.ts";
import {
  rollUpDay, evaluateDay, streaks, DEFAULT_SCORING, type ScoringSettings,
} from "../src/lib/scoring.ts";
import {
  allCategories, deenCategory, growthCategory, workCategory, healthCategory,
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
  prayersPerformed: 0, prayersOnTime: 0, elapsedPrayers: 5,
  quranPages: null, quranGoalPages: 1, dhikrDone: null, muhasabahDone: false,
  commitmentsDue: 0, commitmentsKept: 0,
  keptPromises: null, wasHonest: null, madeExcuses: null,
  sleepMinutes: null, sleepGoalHours: 7, wakeConsistentMinutes: null,
  movement: null, hygiene: null,
  topPriority: null, topPriorityDone: null, deepWorkMinutes: null,
  deepWorkTargetMinutes: 120, workCommitmentsDue: 0, workCommitmentsKept: 0,
  valueCreated: null,
  familyContact: null, familyResponsibility: null,
  unnecessarySpend: null, spendLogged: false, moneyActionTaken: null,
  learningMinutes: null, learningTargetMinutes: 30, learningApplied: null,
  businessActivityToday: null, businessWeeklyPace: null,
};

const perfectDeen: Partial<ScoringInputs> = {
  prayersPerformed: 5, prayersOnTime: 5, quranPages: 2,
  dhikrDone: true, muhasabahDone: true,
};
const perfectRest: Partial<ScoringInputs> = {
  commitmentsDue: 2, commitmentsKept: 2, keptPromises: true, wasHonest: true, madeExcuses: false,
  sleepMinutes: 480, wakeConsistentMinutes: 0, movement: true, hygiene: true,
  topPriority: "X", topPriorityDone: true, deepWorkMinutes: 180,
  workCommitmentsDue: 1, workCommitmentsKept: 1, valueCreated: "shipped",
  familyContact: true, familyResponsibility: true,
  unnecessarySpend: 0, spendLogged: true, moneyActionTaken: true,
  learningMinutes: 60, learningApplied: true,
  businessActivityToday: 3, businessWeeklyPace: 1,
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

console.log("\nCategory scoring");
t("an unlogged category is null, never zero", () => {
  const c = allCategories(base);
  assert.equal(c.family.pct, null, "family with nothing logged must be null");
  assert.equal(c.financial.pct, null);
});
t("obligatory prayer sub-metrics outweigh the optional ones", () => {
  const d = deenCategory({ ...base, ...perfectDeen });
  const perf = d.subs.find((s) => s.key === "prayers_performed")!;
  const quran = d.subs.find((s) => s.key === "quran")!;
  assert.ok(perf.obligatory);
  assert.equal(perf.weight / quran.weight, 2, "obligatory carries 2x an optional sub-metric");
});
t("praying late still earns the obligation but not the punctuality", () => {
  const d = deenCategory({ ...base, prayersPerformed: 5, prayersOnTime: 0 });
  assert.equal(d.subs.find((s) => s.key === "prayers_performed")!.value, 1);
  assert.equal(d.subs.find((s) => s.key === "prayers_on_time")!.value, 0);
});
t("Qur'an below goal still scores above zero", () => {
  const some = deenCategory({ ...base, quranPages: 0.5, quranGoalPages: 2 });
  const none = deenCategory({ ...base, quranPages: 0, quranGoalPages: 2 });
  assert.equal(some.subs.find((s) => s.key === "quran")!.value, 0.6);
  assert.equal(none.subs.find((s) => s.key === "quran")!.value, 0);
});
t("Muhasabah scores completion only, never content", () => {
  const d = deenCategory({ ...base, muhasabahDone: true });
  const m = d.subs.find((s) => s.key === "muhasabah")!;
  assert.equal(m.value, 1);
  assert.ok(!/content|wrote:|text/i.test(m.detail));
});
t("learning without applying is capped below full", () => {
  const notApplied = growthCategory({ ...base, learningMinutes: 180, learningApplied: false });
  const applied = growthCategory({ ...base, learningMinutes: 180, learningApplied: true });
  assert.ok(notApplied.pct! < applied.pct!, "applying must beat not applying");
  assert.equal(applied.pct, 100);
  assert.ok(notApplied.pct! <= 40, `three hours unapplied should stay low, got ${notApplied.pct}`);
});
t("work measures value, not hours at a desk", () => {
  const subs = workCategory({ ...base, topPriority: "X", topPriorityDone: true }).subs;
  assert.ok(!subs.some((s) => /hours worked|total hours/i.test(s.label)),
    "raw hours must not be a work sub-metric");
});
t("every sub-metric explains its own number", () => {
  const cats = allCategories({ ...base, ...perfectDeen, ...perfectRest });
  for (const c of Object.values(cats))
    for (const s of c.subs)
      assert.ok(s.detail && s.detail.length > 0, `${c.key}.${s.key} must justify itself`);
});

console.log("\nThe Foundation gate");
function overallFor(F: number, L: number) {
  // Drive the roll-up directly at the arithmetic it performs.
  const share = S.foundationShare, offset = S.gateCapOffset;
  return Math.min(F * share + L * (1 - share), F + offset);
}
t("a perfect day still reaches 100", () => {
  const r = rollUpDay({ ...base, ...perfectDeen, ...perfectRest }, S, true);
  assert.equal(r.foundation.pct, 100);
  assert.equal(r.life.pct, 100);
  assert.equal(r.overallPct, 100, "the cap must not punish a complete day");
});
t("collapsed foundation caps a productive day", () => {
  const r = rollUpDay({ ...base, ...perfectRest, prayersPerformed: 0, prayersOnTime: 0,
    quranPages: 0, dhikrDone: false, muhasabahDone: false }, S, true);
  assert.ok(r.gated, "the ceiling should bind");
  assert.ok(r.overallPct! < r.ungatedPct!, "gated must be below the plain blend");
  assert.equal(r.overallPct, Math.round((r.foundation.pct! + 15) * 100) / 100);
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
t("the gate binds exactly when Life exceeds Foundation by offset/(1-share)", () => {
  // Cap binds when F*share + L*(1-share) > F + offset
  //            <=> L > F + offset/(1-share)   = F + 37.5 at the defaults
  const gap = S.gateCapOffset / (1 - S.foundationShare);
  assert.ok(Math.abs(gap - 37.5) < 1e-9, `expected 37.5, got ${gap}`);
  for (const F of [0, 20, 40, 60, 80]) {
    const justUnder = overallFor(F, F + gap - 1);
    const justOver = overallFor(F, F + gap + 1);
    assert.ok(Math.abs(justUnder - (F * S.foundationShare + (F + gap - 1) * (1 - S.foundationShare))) < 1e-9,
      `below the crossover the blend should win at F=${F}`);
    assert.ok(Math.abs(justOver - Math.min(F + S.gateCapOffset,
      F * S.foundationShare + (F + gap + 1) * (1 - S.foundationShare))) < 1e-9);
  }
  // At the crossover the two branches agree — which is why it is smooth.
  const F = 40, Lcross = F + gap;
  assert.ok(Math.abs((F * S.foundationShare + Lcross * (1 - S.foundationShare)) - (F + S.gateCapOffset)) < 1e-9);
});
t("Overall is never a plain average of the two scores", () => {
  const F = 20, L = 100;
  assert.notEqual(overallFor(F, L), (F + L) / 2);
  assert.ok(overallFor(F, L) < (F + L) / 2, "the gate must pull it below the midpoint");
});
t("a blank category counts as zero once the day is closed", () => {
  const open = rollUpDay({ ...base, ...perfectDeen }, S, false);
  const closed = rollUpDay({ ...base, ...perfectDeen }, S, true);
  assert.ok(closed.life.pct !== null && open.life.pct === null,
    "an unfinished day excludes blanks; a closed one counts them");
});
t("morning is not scored as failure", () => {
  const r = rollUpDay({ ...base, elapsedPrayers: 1, prayersPerformed: 1, prayersOnTime: 1 }, S, false);
  assert.equal(r.categories.deen.subs.find((s) => s.key === "prayers_performed")!.value, 1);
});

console.log("\nDay evaluation");
t("no state ever calls a day worthless", () => {
  const states = [
    evaluateDay(0, 0, 0, false, 5), evaluateDay(20, 90, 35, true, 5),
    evaluateDay(50, 50, 50, false, 5), evaluateDay(90, 90, 90, false, 5),
    evaluateDay(0, 0, 0, false, 1),
  ];
  for (const e of states) {
    const words = (e.headline + " " + e.note).toLowerCase();
    for (const bad of ["worthless", "failure", "failed", "pathetic", "lazy", "shame"])
      assert.ok(!words.includes(bad), `must not say "${bad}" — got: ${e.headline}`);
  }
});
t("strong work never rescues a broken foundation", () => {
  const e = evaluateDay(20, 95, 35, true, 5);
  assert.equal(e.state, "growth_only");
  assert.ok(e.suggestReset);
});
t("foundation held with quiet growth is not a bad day", () => {
  const e = evaluateDay(85, 20, 59, false, 5);
  assert.equal(e.state, "foundation_held");
  assert.equal(e.suggestReset, false);
});
t("early morning with nothing logged is 'still ahead of you'", () => {
  const e = evaluateDay(0, 0, 0, false, 1);
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
