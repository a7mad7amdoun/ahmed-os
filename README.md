# Ahmed OS

**Deen first. Discipline always. Progress through consistency.**

A private personal operating system. Not a productivity dashboard — a command
centre for rebuilding a life, in the order that matters:
Deen → Foundation → Responsibility → Growth.

---

## Run it locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On first run you choose a name and a passcode.

There is **nothing else to set up**. With no `DATABASE_URL`, the app runs on
[PGlite](https://pglite.dev) — a genuine Postgres compiled to WebAssembly —
storing everything in `./.data/pg`. Your data never leaves the machine.
Back it up by copying that folder.

```bash
npm test        # 32 domain tests: scoring, prayer windows, pattern gate
npm run test:e2e  # 38 end-to-end tests (needs the dev server running)
```

---

## Deploy it

The same schema and SQL run in both places, so nothing changes but the driver.

1. **Create a Postgres database** — [Neon](https://neon.tech) has a free tier
   that suits a single user. Copy the connection string.
2. **Push to a Git repo**, then import it in [Vercel](https://vercel.com).
3. **Set two environment variables** in the Vercel project:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Postgres connection string |
   | `SESSION_SECRET` | 32+ random characters — `openssl rand -base64 32` |

4. Deploy. Migrations run automatically on first request.

The app refuses to boot in production without `DATABASE_URL`, rather than
silently falling back to a file that a serverless host cannot persist.

Add it to your phone's home screen from the browser share menu — the layout is
built mobile-first.

---

## What is built

| Area | State |
|---|---|
| Dashboard, next action, day evaluation | ✅ |
| Five daily prayers, real punctuality | ✅ |
| Voluntary practices, tracked separately | ✅ |
| Qur'an tracking | ✅ |
| Foundation + Life Progress scores | ✅ |
| Muhasabah (daily reflection) | ✅ |
| Reset Protocol + recovery plan | ✅ |
| Sleep and basic health | ✅ |
| Pattern insights (gated on real data) | ✅ |
| Weekly review (Friday) | schema ready, UI next |
| Financial recovery dashboard | schema next |
| Monthly / quarterly / yearly reviews | after a month of data exists |

---

## The decisions worth knowing

**Prayer times are computed, not guessed.** Punctuality is measured against
actual prayer times for your coordinates, calculated locally with no network
call. The defaults are the Moroccan Ministry of Habous angles (Fajr 19°,
Isha 17°); if your masjid's timetable differs, adjust them in Settings until
the app agrees with the mosque you actually pray in. "On time" means *prayed
within N minutes of the prayer entering* — N is yours to set, and the window
is printed on screen next to every prayer. It is your own standard, not a ruling.

**Obligatory and voluntary never mix.** The five prayers live in their own
table with their own vocabulary. Sunnah, Witr and dhikr live in another. No
sum, no score, and no screen ever lets a completed Sunnah visually compensate
for a missed Fard.

**Two scores, never averaged.** Foundation (0–20) covers obligation, Deen,
integrity and basic health. Life Progress (0–20) covers work, learning, family
and money. They sit side by side and the dashboard says plainly that a strong
Life Progress score does not repair a weak Foundation. Every component shows
what it gave, out of what, and why — nothing is a hidden weight.

**The day's verdict is a state, not an average.** Six named states, from
"the day is still ahead of you" to "today did not hold". None of them calls a
day worthless; a test asserts the words *worthless, failure, failed, pathetic,
lazy* and *shame* never reach the screen.

**Morning is not failure.** Foundation is scored out of a maximum that grows as
each prayer enters. At 9am you are judged on the prayers that have actually come.

**No invented conclusions.** The pattern engine reports observed differences
between groups of your own days, with the sample size attached, and only past
14 logged days with 5+ days on each side of a comparison. Below that it says
how much more data it needs and nothing else. It never claims causation — a
test asserts the words *because, causes, due to* and *proves* never appear in
an insight.

**Silence is not forgiveness.** An unlogged day stays visibly unlogged. The
dashboard shows "last day the foundation held: 6 days ago" — factual, never
accusing. The Reset Protocol caps its recovery plan at four small actions,
because rebuilding the whole life tonight is the failure mode, not the goal.
Each one becomes a recorded commitment the weekly review will ask about.

**Muhasabah is sealed.** Reflection text is never scored, never analysed for
patterns, never summarised, and never shown outside its own page. Tests assert
it cannot leak to the dashboard or the insights page.

---

## Architecture

```
src/
  db/schema.ts       Postgres schema (Drizzle) — obligation and option kept apart
  db/index.ts        One schema, two drivers: PGlite locally, postgres-js hosted
  lib/prayer-times.ts  adhan-based windows; pure, testable punctuality rules
  lib/scoring.ts     The two scores + day evaluation. Pure functions, no I/O
  lib/patterns.ts    Gated correlation reporting
  lib/data.ts        Loading and persistence
  app/               Dashboard, check-in, muhasabah, reset, insights, settings
tests/               70 tests, no framework — plain Node
```

Domain logic is pure and separate from the UI, so the rules that judge your day
can be read, argued with and tested without running the app.

---

*A bad day is allowed. A delayed return is the real danger. Restart today.*
