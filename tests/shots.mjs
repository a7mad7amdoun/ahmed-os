/* Renders the real authenticated pages in Chrome and saves screenshots.
   The palette validator checks colour, not layout — collisions, overflow
   and geometry have to be looked at. */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const OUT = process.env.OUT ?? ".";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Log in the same way the e2e harness does, to obtain a session cookie.
let cookie = "";
const get = async (p) => {
  const r = await fetch(BASE + p, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  (r.headers.getSetCookie?.() ?? []).forEach((c) => (cookie = c.split(";")[0]));
  return (await r.text()).replace(/<!-- -->/g, "");
};
const html = await get("/login");
const fd = new FormData();
const block = html.split("<form").find((f) => f.includes('value="login"')) ?? "";
for (const m of block.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)) {
  fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}
fd.append("passcode", "test-passcode-1");
const res = await fetch(BASE + "/login", {
  method: "POST", body: fd, headers: { cookie }, redirect: "manual",
});
(res.headers.getSetCookie?.() ?? []).forEach((c) => (cookie = c.split(";")[0]));
const [name, value] = cookie.split("=");
if (!name) { console.error("no session cookie"); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-color-profile=srgb"],
});

const shots = [
  { path: "/", file: "dashboard", w: 1680, h: 1150 },
  { path: "/deen", file: "deen", w: 1680, h: 1150 },
  { path: "/insights", file: "insights", w: 1680, h: 1150 },
  { path: "/weekly", file: "weekly", w: 1680, h: 1150 },
  { path: "/", file: "dashboard-mobile", w: 390, h: 900 },
];

for (const s of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 2 });
  await page.setCookie({ name, value, domain: "localhost", path: "/" });
  await page.goto(BASE + s.path, { waitUntil: "networkidle0", timeout: 60000 });
  // Recharts animates in; wait for it to settle.
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/${s.file}.png`, fullPage: s.file !== "dashboard-mobile" });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${s.file}: ${s.w}px — horizontal overflow ${overflow}px ${overflow > 0 ? "!! FAIL" : "ok"}`);
  await page.close();
}
await browser.close();
