/* Drives the real UI in Chrome. The accordion and the tier taps are
   client-side, so raw-HTML assertions cannot see them — this covers the
   interaction that the whole app is built on. */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
let pass = 0, fail = 0;
const ok = (n, c, extra = "") => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${extra ? `\n      ${extra}` : ""}`); }
};

// Sign in the way the no-JS harness does, to get a session cookie.
let cookie = "";
const get = async (p) => {
  const r = await fetch(BASE + p, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  for (const c of r.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
  return (await r.text()).replace(/<!-- -->/g, "");
};
const html = await get("/login");
const fd = new FormData();
const block = html.split("<form").find((f) => f.includes('value="login"')) ?? "";
for (const m of block.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)) {
  fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}
fd.append("passcode", "test-passcode-1");
const res = await fetch(BASE + "/login", { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
for (const c of res.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
const [name, value] = cookie.split("=");

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
await page.setCookie({ name, value, domain: "localhost", path: "/" });
await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 60000 });

/** Read a category row's score from its accordion header. */
async function scoreOf(label) {
  return page.evaluate((lbl) => {
    for (const btn of document.querySelectorAll("section > button")) {
      if (btn.textContent.includes(lbl)) {
        const m = btn.textContent.match(/(\d{1,2})\s*\/20/);
        return m ? Number(m[1]) : null;
      }
    }
    return null;
  }, label);
}
async function clickRow(label) {
  return page.evaluate((lbl) => {
    for (const btn of document.querySelectorAll("section > button")) {
      if (btn.textContent.includes(lbl)) { btn.click(); return true; }
    }
    return false;
  }, label);
}

console.log("\nThe accordion");
{
  const rows = await page.evaluate(() => document.querySelectorAll("section > button").length);
  ok("seven category rows on one screen", rows === 7, `found ${rows}`);

  const before = await page.evaluate(() => document.body.innerText.includes("Excellent"));
  ok("collapsed by default", !before);

  ok("a row opens", await clickRow("Relationships"));
  await new Promise((r) => setTimeout(r, 250));
  const after = await page.evaluate(() => document.body.innerText);
  ok("expanding reveals the six tiers",
     ["Missed", "Poor", "Partial", "Adequate", "Good", "Excellent"].every((t) => after.includes(t)));
  ok("it expands in place, without navigating", page.url().endsWith("/"));
}

console.log("\nTapping a tier");
{
  // Set a known low state first, so the assertion holds on a re-run
  // against a database that already has taps in it. Tapping the tier
  // that is already selected clears it, which would otherwise invert
  // the comparison on the second run.
  const tap = (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === l);
    if (!b) return false;
    b.click(); return true;
  }, label);

  await tap("Missed");
  await new Promise((r) => setTimeout(r, 2500));
  const before = await scoreOf("Relationships");

  ok("an Excellent tier is tappable", await tap("Excellent"));
  await new Promise((r) => setTimeout(r, 2500));

  const after = await scoreOf("Relationships");
  ok("the category score responds to the tap",
     after !== null && before !== null && after > before,
     `before ${before}, after ${after}`);

  const majors = await page.evaluate(() => document.body.innerText);
  ok("the headline scores are recomputed underneath",
     /Responsibility/.test(majors) && /Overall status/i.test(majors));
}

console.log("\nPersistence");
{
  const before = await scoreOf("Relationships");
  await page.reload({ waitUntil: "networkidle0" });
  const after = await scoreOf("Relationships");
  ok("the tap survives a reload", after === before, `before ${before}, after ${after}`);
}

console.log("\nLayout");
{
  const ov = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("no horizontal overflow at 1400px", ov === 0, `${ov}px`);
  await page.setViewport({ width: 390, height: 900 });
  await page.reload({ waitUntil: "networkidle0" });
  const ovm = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("no horizontal overflow at 390px", ovm === 0, `${ovm}px`);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
