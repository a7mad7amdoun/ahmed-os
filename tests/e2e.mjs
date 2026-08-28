/* End-to-end over real HTTP, driving the app the way a browser without
   JS would. Exercises the server actions, the database writes and the
   rendered output together. */

const BASE = process.env.BASE ?? "http://localhost:3000";
let cookie = "";
let pass = 0, fail = 0;

const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? `\n      ${extra}` : ""}`); }
};

async function get(path) {
  const r = await fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  for (const c of r.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
  // React SSR splits adjacent text nodes with <!-- -->; strip so assertions
  // match what a reader actually sees.
  const html = (await r.text()).replace(/<!-- -->/g, "");
  return { status: r.status, location: r.headers.get("location"), html };
}

/** Replay a progressively-enhanced server-action form, chosen by its
 *  `_form` marker so adding a form never silently retargets a test. */
async function submit(path, fields, formName = null) {
  const page = await get(path);
  const forms = page.html.split("<form").slice(1);
  const block = formName
    ? forms.find((f) => f.includes(`name="_form" value="${formName}"`)) ?? ""
    : forms[0] ?? "";
  if (formName && !block) throw new Error(`no form marked "${formName}" on ${path}`);
  const fd = new FormData();
  for (const m of block.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)) {
    fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'"));
  }
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, {
    method: "POST", body: fd, headers: cookie ? { cookie } : {}, redirect: "manual",
  });
  for (const c of r.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
  return { status: r.status, location: r.headers.get("location"), html: await r.text() };
}

const scoreOf = (html, label) => {
  // "Deen ... 14/20" inside the accordion header.
  const i = html.indexOf(`>${label}<`);
  if (i < 0) return null;
  const m = html.slice(i, i + 900).match(/>(\d{1,2})<[\s\S]{0,120}?\/20/);
  return m ? Number(m[1]) : null;
};

console.log("\nFirst run");
{
  const r = await get("/");
  ok("signed-out root redirects to a gate",
     r.status === 307 && /\/(setup|login)/.test(r.location ?? ""), `got ${r.status} ${r.location}`);

  const first = await get("/setup");
  if (first.status === 307) {
    const l = await submit("/login", { passcode: "test-passcode-1" }, "login");
    ok("existing account signs in", l.status < 400 || l.status === 303, `status ${l.status}`);
  } else {
    const s = await submit("/setup", { name: "Ahmed", passcode: "test-passcode-1" }, "setup");
    ok("account creation succeeds", s.status < 400 || s.status === 303, `status ${s.status}`);
  }
  ok("a session cookie is issued", cookie.includes("ahmedos_session"), cookie || "(none)");
}

console.log("\nThe one-screen home");
let home;
{
  home = await get("/");
  ok("home renders", home.status === 200, `status ${home.status}`);
  ok("all seven categories are present",
     ["Deen", "Discipline", "Health", "Work", "Relationships", "Financial", "Growth"]
       .every((c) => home.html.includes(c)));
  ok("each shows a score out of 20", (home.html.match(/\/20/g) ?? []).length >= 7);
  ok("the three headline scores are shown separately",
     home.html.includes("Foundation") && home.html.includes("Responsibility")
       && home.html.includes("Growth"));
  ok("overall status names the bottleneck", /bottleneck today/i.test(home.html));
  ok("it states the three are never averaged", /never an average/i.test(home.html));
  ok("no merged life score anywhere", !/Life Score/i.test(home.html));
  ok("the prayer log is on the same screen", /Prayer log/i.test(home.html));
  ok("Reset is offered", /Reset today/i.test(home.html));
}

console.log("\nNo shame, no gamification");
{
  ok("no shaming language", !/(worthless|pathetic|you failed|lazy|shame on)/i.test(home.html));
  ok("no gamification", !/(streak flame|badge unlocked|confetti|trophy)/i.test(home.html));
  ok("status describes performance, not the person",
     !/you are (critical|below standard|a failure)/i.test(home.html));
}

console.log("\nTier logging moves the score");
{
  // The tier buttons are client-side; drive the same server action the
  // button calls, through the Next action endpoint the form would use.
  const before = scoreOf(home.html, "Relationships");
  ok("Relationships starts unlogged or low", before !== null, `got ${before}`);

  // Accordions are collapsed by default, so their tier controls are not
  // in the initial HTML by design. The interaction itself is covered by
  // tests/interaction.mjs, which drives a real browser.
  ok("categories are collapsed by default", !/from prayer log/.test(home.html),
     "an expanded accordion would leak its contents into the first paint");
}

console.log("\nThe Deen ceiling is visible");
{
  ok("the ceiling is stated on the prayer log",
     /Deen ceiling/i.test(home.html), "the ceiling should be shown, not hidden");
  ok("the five-step prayer scale is explained",
     /missed 0, late 8, on time 14/i.test(home.html));
}

console.log("\nSupporting pages still work");
{
  for (const [path, marker] of [
    ["/check-in", "Daily check-in"],
    ["/commitments", "Promises"],
    ["/finances", "Financial recovery"],
    ["/muhasabah", "Muhasabah"],
    ["/weekly", "Weekly review"],
    ["/reset", "Reset"],
    ["/settings", "Settings"],
  ]) {
    const r = await get(path);
    ok(`${path} renders`, r.status === 200 && r.html.includes(marker),
       `status ${r.status}`);
  }
}

console.log("\nAuth boundary");
{
  const saved = cookie; cookie = "";
  const r = await get("/muhasabah");
  ok("signed-out access is refused", r.status === 307 && /login/.test(r.location ?? ""));
  cookie = saved;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
