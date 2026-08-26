/* Domain tests. Run: npm test
   These cover the rules that decide what the app tells Ahmed about
   himself — punctuality, the two scores, and the pattern gate. */

import assert from "node:assert/strict";
import { windowsFor, deriveStatus, PRAYERS } from "../src/lib/prayer-times.ts";
import { foundationScore, lifeProgressScore, evaluateDay, type DayInput } from "../src/lib/scoring.ts";
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

const base: DayInput = {
  prayers: PRAYERS.map((p) => ({ prayer: p, status: "not_logged" as const })),
  elapsedPrayers: 5, quranPages: null, quranGoalPages: 1,
  keptPromises: null, wasHonest: null, madeExcuses: null,
  sleepMinutes: null, sleepGoalHours: 7, hygiene: null, movement: null,
  topPriority: null, topPriorityDone: null, deepWorkMinutes: null,
  valueCreated: null, learningMinutes: null, learningApplied: null,
  familyContact: null, familyResponsibility: null,
  unnecessarySpend: null, spendLogged: false,
};

console.log("\nPrayer windows");
t("five windows, strictly increasing", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  assert.equal(w.length, 5);
  for (let i = 1; i < w.length; i++) {
    assert.ok(w[i].start > w[i - 1].start, `${w[i].prayer} must follow ${w[i-1].prayer}`);
  }
});

t("each window ends when the next prayer enters", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  for (let i = 0; i < 4; i++) assert.equal(+w[i].end, +w[i + 1].start);
});

t("Isha runs through to the next Fajr", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  const isha = w[4];
  assert.ok(isha.end > isha.start);
  assert.ok(isha.end.getTime() - isha.start.getTime() < 12 * 3600_000);
});

t("on-time window is exactly the configured length", () => {
  const w = windowsFor("2026-08-26", TETOUAN);
  for (const x of w) assert.equal(x.onTimeUntil.getTime() - x.start.getTime(), 30 * 60_000);
});

t("wider window setting genuinely widens it", () => {
  const w = windowsFor("2026-08-26", { ...TETOUAN, onTimeWindowMinutes: 45 });
  assert.equal(w[0].onTimeUntil.getTime() - w[0].start.getTime(), 45 * 60_000);
});

console.log("\nPunctuality");
const W = windowsFor("2026-08-26", TETOUAN)[1]; // Dhuhr
t("inside the window is on time", () => {
  assert.equal(deriveStatus(W, new Date(+W.start + 10 * 60_000), new Date(+W.start + 10 * 60_000)), "on_time");
});
t("one minute past the window is late, not missed", () => {
  assert.equal(deriveStatus(W, new Date(+W.onTimeUntil + 60_000), new Date(+W.onTimeUntil + 60_000)), "late");
});
t("unprayed but window still open is late, never missed", () => {
  assert.equal(deriveStatus(W, null, new Date(+W.start + 90 * 60_000)), "late");
});
t("unprayed after the window closes is missed", () => {
  assert.equal(deriveStatus(W, null, new Date(+W.end + 60_000)), "missed");
});
t("before the prayer enters it is 'not yet', not a failure", () => {
  assert.equal(deriveStatus(W, null, new Date(+W.start - 60_000)), "not_yet");
});

console.log("\nFoundation score");
t("nothing logged scores zero but the max still stands", () => {
  const s = foundationScore(base);
  assert.equal(s.total, 0);
  assert.equal(s.max, 20);
});

t("all five on time, Qur'an met, sleep good → near full", () => {
  const s = foundationScore({
    ...base,
    prayers: PRAYERS.map((p) => ({ prayer: p, status: "on_time" as const })),
    quranPages: 1, sleepMinutes: 420, hygiene: true,
    keptPromises: true, wasHonest: true, madeExcuses: false,
  });
  assert.equal(s.total, 20);
  assert.equal(s.max, 20);
});

t("prayed late still earns the obligation, not the punctuality", () => {
  const s = foundationScore({
    ...base, prayers: PRAYERS.map((p) => ({ prayer: p, status: "late" as const })),
  });
  const pray = s.components.find((c) => c.key === "prayers")!;
  const punc = s.components.find((c) => c.key === "punctuality")!;
  assert.equal(pray.earned, 7, "praying late is still praying");
  assert.equal(punc.earned, 0, "but it is not on time");
});

t("mid-day max scales with prayers elapsed, so morning isn't a failure", () => {
  const s = foundationScore({
    ...base, elapsedPrayers: 2,
    prayers: [
      { prayer: "fajr", status: "on_time" }, { prayer: "dhuhr", status: "on_time" },
      { prayer: "asr", status: "not_logged" }, { prayer: "maghrib", status: "not_logged" },
      { prayer: "isha", status: "not_logged" },
    ],
  });
  const pray = s.components.find((c) => c.key === "prayers")!;
  assert.equal(pray.earned, pray.max, "two of two prayed = full marks so far");
  assert.ok(s.max < 20, "and the day's max has not fully accrued");
});

t("one Qur'an page below goal still scores above zero", () => {
  const a = foundationScore({ ...base, quranPages: 0.5, quranGoalPages: 2 });
  assert.equal(a.components.find((c) => c.key === "quran")!.earned, 2);
  const b = foundationScore({ ...base, quranPages: 0, quranGoalPages: 2 });
  assert.equal(b.components.find((c) => c.key === "quran")!.earned, 0);
});

t("every component explains itself", () => {
  const s = foundationScore(base);
  for (const c of s.components) {
    assert.ok(c.detail && c.detail.length > 0, `${c.key} must justify its number`);
  }
});

t("components sum exactly to the total", () => {
  const s = foundationScore({ ...base, quranPages: 3, sleepMinutes: 400, keptPromises: true });
  const sum = s.components.reduce((a, c) => a + c.earned, 0);
  assert.ok(Math.abs(sum - s.total) < 0.05);
});

console.log("\nLife Progress score");
t("learning without applying is capped at half", () => {
  const s = lifeProgressScore({ ...base, learningMinutes: 180, learningApplied: false });
  const l = s.components.find((c) => c.key === "learning")!;
  assert.equal(l.earned, 2, "three hours of learning alone is still half marks");
  assert.equal(l.max, 4);
});

t("applying what was learned earns the rest", () => {
  const s = lifeProgressScore({ ...base, learningMinutes: 30, learningApplied: true });
  assert.equal(s.components.find((c) => c.key === "learning")!.earned, 4);
});

t("long hours without the priority done cannot dominate", () => {
  const busy = lifeProgressScore({ ...base, deepWorkMinutes: 600, topPriority: "X", topPriorityDone: false });
  const focused = lifeProgressScore({ ...base, deepWorkMinutes: 120, topPriority: "X", topPriorityDone: true });
  assert.ok(focused.total > busy.total, "finishing what mattered must beat raw hours");
});

console.log("\nDay evaluation");
t("strong work never rescues a broken foundation", () => {
  const f = foundationScore({ ...base, prayers: PRAYERS.map((p) => ({ prayer: p, status: "missed" as const })) });
  const l = lifeProgressScore({
    ...base, topPriority: "X", topPriorityDone: true, deepWorkMinutes: 240,
    valueCreated: "shipped", learningMinutes: 60, learningApplied: true,
    familyContact: true, familyResponsibility: true, unnecessarySpend: 0, spendLogged: true,
  });
  const e = evaluateDay(f, l, 5);
  assert.equal(e.state, "growth_only");
  assert.ok(e.suggestReset);
});

t("a weak day is never called worthless", () => {
  const f = foundationScore(base);
  const l = lifeProgressScore(base);
  const e = evaluateDay(f, l, 5);
  const words = (e.headline + " " + e.note).toLowerCase();
  for (const bad of ["worthless", "failure", "failed", "pathetic", "lazy", "shame"]) {
    assert.ok(!words.includes(bad), `must not say "${bad}"`);
  }
});

t("early morning with nothing logged is 'still ahead of you'", () => {
  const e = evaluateDay(foundationScore({ ...base, elapsedPrayers: 1 }),
                        lifeProgressScore(base), 1);
  assert.equal(e.state, "early");
  assert.equal(e.suggestReset, false);
});

t("foundation held with quiet growth is not treated as a bad day", () => {
  const f = foundationScore({
    ...base, prayers: PRAYERS.map((p) => ({ prayer: p, status: "on_time" as const })),
    quranPages: 1, sleepMinutes: 420, hygiene: true, keptPromises: true, wasHonest: true,
  });
  const e = evaluateDay(f, lifeProgressScore(base), 5);
  assert.equal(e.state, "foundation_held");
  assert.equal(e.suggestReset, false);
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
  assert.equal(r.daysNeeded, 14);
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
  const r = detectPatterns(rows);
  assert.ok(r.ready);
  const s = r.insights.find((x) => x.key === "sleep_fajr");
  assert.ok(s, "expected the sleep/Fajr comparison");
  assert.match(s!.sample, /\d+ nights of 6h\+/);
});

t("a group with too few days is not reported", () => {
  const rows = [
    ...Array.from({ length: 16 }, (_, i) => fact(i, { sleepMinutes: 450, fajrOnTime: true })),
    ...Array.from({ length: 2 }, (_, i) => fact(i + 16, { sleepMinutes: 260, fajrOnTime: false })),
  ];
  const r = detectPatterns(rows);
  assert.equal(r.insights.find((x) => x.key === "sleep_fajr"), undefined,
    "two nights is not evidence");
});

t("insights never assert causation", () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => fact(i, { sleepMinutes: 450, fajrOnTime: true, foundationPct: 0.9 })),
    ...Array.from({ length: 8 }, (_, i) => fact(i + 8, { sleepMinutes: 260, fajrOnTime: false, foundationPct: 0.3 })),
  ];
  const r = detectPatterns(rows);
  for (const i of r.insights) {
    for (const w of ["because", "causes", "caused by", "due to", "proves"]) {
      assert.ok(!i.text.toLowerCase().includes(w), `"${w}" claims cause: ${i.text}`);
    }
  }
});

console.log("\nDates");
t("today is resolved in the user's timezone, not the server's", () => {
  const at = new Date("2026-08-26T23:30:00Z"); // already the 27th in Casablanca
  assert.equal(todayIn("Africa/Casablanca", at), "2026-08-27");
  assert.equal(todayIn("America/New_York", at), "2026-08-26");
});
t("date arithmetic crosses months and years", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-01-01", "2026-03-01"), 59);
});
t("the review week ends on Friday", () => {
  assert.equal(weekStart("2026-08-26", 5), "2026-08-22"); // Saturday
  assert.equal(weekStart("2026-08-28", 5), "2026-08-22"); // Friday closes it
  assert.equal(weekStart("2026-08-29", 5), "2026-08-29"); // new week
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
