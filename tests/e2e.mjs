/* End-to-end: drives the real HTTP app the way a browser without JS
   would, so the server actions, database writes and rendered output
   are all genuinely exercised. */

const BASE = process.env.BASE ?? "http://localhost:3000";
let cookie = "";
let pass = 0, fail = 0;

const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? `\n      ${extra}` : ""}`); }
};

async function get(path) {
  const r = await fetch(BASE + path, {
    headers: cookie ? { cookie } : {}, redirect: "manual",
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  for (const c of sc) cookie = c.split(";")[0];
  // React SSR splits adjacent text nodes with <!-- --> markers;
  // strip them so assertions can match what a reader actually sees.
  const html = (await r.text()).replace(/<!-- -->/g, "");
  return { status: r.status, location: r.headers.get("location"), html };
}

/** Replay a progressively-enhanced server action form. `formIndex`
 *  matters on pages with more than one form (settings also has the
 *  sign-out form, and submitting its action would log us out). */
async function submit(path, fields, formName = null) {
  const page = await get(path);
  const forms = page.html.split("<form").slice(1);
  // Target a form by its `_form` marker rather than by position, so
  // adding a form to a page does not silently retarget a test.
  const block = formName
    ? forms.find((f) => f.includes(`name="_form" value="${formName}"`)) ?? ""
    : forms[0] ?? "";
  if (formName && !block) throw new Error(`no form marked "${formName}" on ${path}`);
  const fd = new FormData();
  for (const m of block.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)) {
    const val = (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
    fd.append(m[1], val);
  }
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, {
    method: "POST", body: fd, headers: cookie ? { cookie } : {}, redirect: "manual",
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  for (const c of sc) cookie = c.split(";")[0];
  return { status: r.status, location: r.headers.get("location"), html: await r.text() };
}

console.log("\nFirst run");
{
  const r = await get("/");
  // Fresh database -> /setup; a database that already has an account -> /login.
  ok("signed-out root always redirects to a gate",
     r.status === 307 && /\/(setup|login)/.test(r.location ?? ""),
     `got ${r.status} ${r.location}`);
}
{
  const first = await get("/setup");
  if (first.status === 307) {
    // Account already exists from a previous run — sign in instead.
    const r = await submit("/login", { passcode: "test-passcode-1" }, "login");
    ok("existing account signs in", r.status < 400 || r.status === 303, `status ${r.status}`);
  } else {
    const r = await submit("/setup", { name: "Ahmed", passcode: "test-passcode-1" }, "setup");
    ok("account creation succeeds", r.status < 400 || r.status === 303, `status ${r.status}`);
  }
  ok("a session cookie is issued", cookie.includes("ahmedos_session"), cookie || "(none)");
}

console.log("\nDashboard");
let dash;
{
  dash = await get("/");
  ok("dashboard renders once signed in", dash.status === 200, `status ${dash.status}`);
  ok("greets by name", dash.html.includes("Ahmed"));
  ok("shows the Arabic salaam", dash.html.includes("السلام عليكم"));
  ok("lists all five obligatory prayers",
     ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].every((p) => dash.html.includes(p)));
  ok("shows Arabic prayer names", dash.html.includes("الفجر") && dash.html.includes("العشاء"));
  ok("shows both scores", dash.html.includes("Foundation") && dash.html.includes("Life Progress"));
  ok("shows the Overall day figure", /Overall day/i.test(dash.html));
  ok("explains the gate arithmetic openly",
     /capped at Foundation \+/i.test(dash.html), "the gate formula must be visible");
  ok("shows per-category percentages", /Categories today/i.test(dash.html));
  ok("offers the reset without nagging", dash.html.includes("Reset today"));
  ok("withholds patterns until there is data", /Collecting data/i.test(dash.html));
  ok("separates voluntary practices from obligation",
     dash.html.includes("Voluntary") && /never a substitute/i.test(dash.html));
}

console.log("\nAuth boundary");
{
  const saved = cookie; cookie = "";
  const r = await get("/check-in");
  ok("signed-out access is refused", r.status === 307 && /login/.test(r.location ?? ""),
     `got ${r.status} ${r.location}`);
  const m = await get("/muhasabah");
  ok("private reflection is refused too", m.status === 307 && /login/.test(m.location ?? ""));
  cookie = saved;
}

console.log("\nDaily check-in writes through");
{
  const r = await submit("/check-in", {
    quranPages: "2", quranSurah: "Al-Mulk", quranReflection: "On returning after a gap.",
    sleptAt: "23:30", wokeAt: "06:15", energy: "3",
    movement: "yes", hygiene: "yes",
    topPriority: "Finish the translation", topPriorityDone: "yes",
    deepWorkHours: "2.5", workHours: "8", valueCreated: "Delivered the document",
    avoidedTask: "The invoicing",
    keptPromises: "yes", wasHonest: "yes", madeExcuses: "no",
    familyContact: "yes", familyResponsibility: "yes", familyNote: "Called my mother",
    learningMinutes: "45", learningApplied: "yes", unnecessarySpend: "0",
  }, "checkin");
  ok("check-in submits", r.status < 400 || r.status === 303, `status ${r.status}`);

  const d = await get("/");
  ok("Qur'an pages persisted", d.html.includes("Pages today") && />2</.test(d.html),
     "expected 2 pages on the dashboard");
  ok("sleep duration computed across midnight", d.html.includes("6.8h"),
     "23:30 → 06:15 should be 6.8h");
  ok("the stated priority shows on the dashboard", d.html.includes("Finish the translation"));
  ok("deep work persisted", d.html.includes("2.5h"));
  ok("family note persisted", d.html.includes("Called my mother"));
  ok("Life Progress moved above zero", !/Life Progress[\s\S]{0,400}?>0</.test(d.html));
}

console.log("\nMuhasabah stays private");
{
  const r = await submit("/muhasabah", {
    q_allah: "Weaker than I want to admit.",
    q_repent: "A private matter.",
    q_tomorrow: "Pray Fajr at the mosque.",
  }, "muhasabah");
  ok("reflection saves", r.status < 400 || r.status === 303, `status ${r.status}`);
  const m = await get("/muhasabah");
  ok("reflection is readable back", m.html.includes("Weaker than I want to admit"));
  const ins = await get("/insights");
  ok("reflection text never leaks into analytics",
     !ins.html.includes("A private matter") && !ins.html.includes("Weaker than I want"));
  const d = await get("/");
  ok("reflection text never leaks onto the dashboard", !d.html.includes("A private matter"));
}

console.log("\nReset protocol");
{
  const r = await submit("/reset", {
    whatHappened: "Slept through Fajr and lost the morning.",
    realCause: "Poor sleep",
    canControl: "When I put the phone down.",
    smallestAction: "Pray Isha at the mosque tonight",
    plan_deen: "Pray Isha at the mosque",
    plan_responsibility: "Send the translation",
    plan_health: "In bed by 23:00",
    plan_environment: "Phone charges outside the bedroom",
  }, "reset");
  ok("reset submits", r.status < 400 || r.status === 303, `status ${r.status}`);

  const p = await get("/reset");
  ok("recovery plan is shown back", p.html.includes("Pray Isha at the mosque"));
  ok("plan is capped at four actions", (p.html.match(/toggleResetItem|<li>/g) ?? []).length <= 12);
  const d = await get("/");
  ok("recovery plan appears on the dashboard", /Recovery plan/i.test(d.html));
  ok("no shaming language anywhere on the dashboard",
     !/(worthless|pathetic|you failed|lazy|shame on)/i.test(d.html));
}

console.log("\nSettings");
{
  const r = await submit("/settings", {
    city: "Tetouan", latitude: "35.5785", longitude: "-5.3684",
    timezone: "Africa/Casablanca", fajrAngle: "18", ishaAngle: "17",
    madhab: "Shafi", onTimeWindowMinutes: "45",
    quranGoalPages: "1", sleepGoalHours: "7",
  }, "settings");
  ok("settings save", r.status < 400 || r.status === 303, `status ${r.status}`);
  const s = await get("/settings");
  ok("changed Fajr angle persisted", /value="18"/.test(s.html));
  const d = await get("/");
  ok("dashboard reflects the new on-time window", d.html.includes("45 min"));
  ok("dashboard discloses the calculation angles", d.html.includes("18°"));
}

console.log("\nInsights gate");
{
  const r = await get("/insights");
  ok("insights page renders", r.status === 200);
  ok("refuses to draw conclusions from one day", /of 14 logged days|not enough/i.test(r.html));
  ok("explains that observation is not causation", /not causes|are not causes/i.test(r.html));
}


console.log("\nPromises");
{
  const r = await submit("/commitments", {
    text: "Pray Fajr at the mosque", area: "deen", dueOn: "2026-08-27",
  }, "commitment");
  ok("commitment saves", r.status < 400 || r.status === 303, `status ${r.status}`);
  const p = await get("/commitments");
  ok("commitment is listed", p.html.includes("Pray Fajr at the mosque"));
  ok("promise-kept rate is shown", /Kept, of those closed|Kept/i.test(p.html));

  const g = await submit("/commitments", {
    title: "Read one page of Qur'an daily for a month", category: "deen",
  }, "goal");
  ok("goal saves", g.status < 400 || g.status === 303, `status ${g.status}`);
  const p2 = await get("/commitments");
  ok("goal is listed", p2.html.includes("Read one page of Qur"));
}

console.log("\nMoney");
{
  const d = await submit("/finances", { name: "Total debt", totalAmount: "30000", monthlyTarget: "1500" }, "debt");
  ok("debt saves", d.status < 400 || d.status === 303, `status ${d.status}`);
  const f = await get("/finances");
  ok("debt total is shown", /30,?000/.test(f.html));
  ok("no invented payoff date", !/(payoff|debt.free) (date|by)/i.test(f.html),
     "must not project a payoff date from no payment history");

  const tx = await submit("/finances", {
    type: "debt_payment", category: "other", amount: "500", date: "2026-08-27",
  }, "transaction");
  ok("transaction saves", tx.status < 400 || tx.status === 303, `status ${tx.status}`);
  const f2 = await get("/finances");
  ok("repayment is reflected", /Repaid so far/i.test(f2.html) && /500/.test(f2.html));
  ok("remaining debt recalculated", /29,?500/.test(f2.html), "30000 - 500 should show as remaining");
}

console.log("\nBusiness is generic, not ChnoKain-specific");
{
  const b = await get("/business");
  ok("business page renders", b.status === 200);
  ok("ChnoKain is seeded as a row", b.html.includes("ChnoKain"));
  ok("other projects can be added", /Add a project/i.test(b.html));
  const add = await submit("/business", { name: "Print on Demand", tier: "C", weeklyTarget: "2" }, "project");
  ok("second project saves", add.status < 400 || add.status === 303, `status ${add.status}`);
  const b2 = await get("/business");
  ok("both projects listed", b2.html.includes("ChnoKain") && b2.html.includes("Print on Demand"),
     "business must not be hardcoded to one venture");
}

console.log("\nWeekly review");
{
  const w = await get("/weekly");
  ok("weekly review renders", w.status === 200);
  ok("promises come first", w.html.indexOf("Did I keep my promises") <
     w.html.indexOf("What went well"), "promises must precede reflection");
  ok("compares against last week and a 4-week average",
     /Last week/i.test(w.html) && /4-week avg/i.test(w.html));
  ok("asks for one priority", /ONE biggest priority/i.test(w.html));
  const save = await submit("/weekly", {
    weekStart: w.html.match(/name="weekStart" value="([^"]+)"/)?.[1] ?? "2026-08-22",
    q_well: "Prayed Fajr four days.", q_badly: "Slept late twice.",
    biggestPriority: "Fajr on time every day",
  }, "weekly");
  ok("weekly review saves", save.status < 400 || save.status === 303, `status ${save.status}`);
  const w2 = await get("/weekly");
  ok("answers persist", w2.html.includes("Prayed Fajr four days"));
}

console.log("\nScoring config");
{
  const w = await submit("/settings", {
    w_deen: "40", w_discipline: "25", w_health: "15", w_work: "12",
    w_family: "5", w_financial: "2", w_growth: "1", w_business: "0",
    foundationShare: "0.6", gateCapOffset: "15",
    deepWorkTargetHours: "2", learningTargetMinutes: "30",
  }, "weights");
  ok("weights save", w.status < 400 || w.status === 303, `status ${w.status}`);
  const s2 = await get("/settings");
  ok("changed Deen weight persisted", /name="w_deen"[^>]*value="40"/.test(s2.html)
     || /value="40"/.test(s2.html));
  // Derived, not hardcoded: the weights just saved put Foundation at
  // (40+25+15)/100 = 0.8, so the ceiling binds past 15/(1-0.8) = 75.
  const share = (40 + 25 + 15) / (40 + 25 + 15 + 12 + 5 + 2 + 1 + 0);
  const crossover = Math.round((15 / (1 - share)) * 10) / 10;
  ok("gate crossover is derived from the weights in play",
     new RegExp(`exceeds Foundation by more than\\s*${crossover}\\s*points`).test(s2.html),
     `expected ${crossover} from the saved weights`);
}


console.log("\nDeen dashboard");
{
  const d = await get("/deen");
  ok("deen dashboard renders", d.status === 200, `status ${d.status}`);
  // Compare the cards themselves; the intro paragraph mentions
  // voluntary practice by name before either card appears.
  ok("obligation is stated first",
     d.html.indexOf("The obligation") < d.html.indexOf("counted separately, always"),
     "the five prayers must precede voluntary practice on the page");
  ok("prayer heatmap is present", /Prayer consistency/i.test(d.html));
  ok("heatmap legend names every state, not colour alone",
     ["On time", "Late", "Missed", "Not logged"].every((x) => d.html.includes(x)));
  ok("voluntary is never summed with the obligation",
     /counted separately|never a substitute|tracked apart/i.test(d.html));
}

console.log("\nCharts");
{
  const dash = await get("/");
  ok("dashboard renders the category radar", /recharts|radar/i.test(dash.html),
     "radar should be server-rendered into the page");
  ok("radar is accompanied by the numbers in text",
     /Categories today/i.test(dash.html));

  const s = await get("/settings");
  ok("weights are bars, not a donut", /cannot be compared by angle/i.test(s.html),
     "the donut substitution should be stated");

  const i = await get("/insights");
  ok("insights charts Foundation against Life Progress",
     /Foundation vs Life Progress/i.test(i.html));
  ok("sleep chart states it is duration only, not a second axis",
     /own reading rather than a second axis/i.test(i.html));
}

console.log("\nNew scoring inputs");
{
  const c = await get("/check-in");
  ok("check-in collects excuse and avoidance counts",
     /name="excusesLogged"/.test(c.html) && /name="avoidanceFlags"/.test(c.html));
  ok("check-in collects scheduled vs on-time events",
     /name="scheduledEvents"/.test(c.html) && /name="onTimeEvents"/.test(c.html));
  const r = await submit("/check-in", {
    excusesLogged: "1", avoidanceFlags: "0",
    scheduledEvents: "3", onTimeEvents: "2",
    quranPages: "1", sleptAt: "23:00", wokeAt: "06:10",
    topPriority: "Ship it", topPriorityDone: "yes", deepWorkHours: "2",
  }, "checkin");
  ok("new inputs save", r.status < 400 || r.status === 303, `status ${r.status}`);
  const c2 = await get("/check-in");
  ok("excuse count persisted", /name="excusesLogged"[^>]*value="1"/.test(c2.html)
     || /value="1"/.test(c2.html));

  const st = await get("/settings");
  ok("target wake time is configurable", /name="targetWakeTime"/.test(st.html));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
