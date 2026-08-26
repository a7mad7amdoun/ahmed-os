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
async function submit(path, fields, formIndex = 0) {
  const page = await get(path);
  const forms = page.html.split("<form").slice(1);
  const block = forms[formIndex] ?? "";
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
    const r = await submit("/login", { passcode: "test-passcode-1" });
    ok("existing account signs in", r.status < 400 || r.status === 303, `status ${r.status}`);
  } else {
    const r = await submit("/setup", { name: "Ahmed", passcode: "test-passcode-1" });
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
  ok("states that the scores are never averaged", /never averaged/i.test(dash.html));
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
  });
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
  });
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
  });
  ok("reset submits", r.status < 400 || r.status === 303, `status ${r.status}`);

  const p = await get("/reset");
  ok("recovery plan is shown back", p.html.includes("Pray Isha at the mosque"));
  ok("plan is capped at four actions", (p.html.match(/toggleResetItem|<li>/g) ?? []).length <= 12);
  const d = await get("/");
  ok("recovery plan appears on the dashboard", d.html.includes("Today's recovery plan"));
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
  });
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
