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
npm test          # 38 domain tests: scoring, the gate, prayer windows, pattern threshold
npm run test:e2e  # 65 end-to-end tests over real HTTP (needs a server running)
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
| Five daily prayers, measured punctuality | ✅ |
| Voluntary practices, tracked separately | ✅ |
| Qur'an tracking | ✅ |
| Eight category scores → Foundation + Life Progress → Overall | ✅ |
| Configurable weights and gate constants | ✅ |
| Muhasabah (daily reflection) | ✅ |
| Reset Protocol + recovery plan (24h, one Deen carry) | ✅ |
| Goals & Commitments | ✅ |
| Friday Weekly Review | ✅ |
| Financial Recovery dashboard | ✅ |
| Sleep and basic health | ✅ |
| Businesses & projects (basic logging) | ✅ |
| Pattern insights (gated on real data) | ✅ |
| Installable PWA | ✅ |
| Monthly / quarterly / 6-month / yearly reviews | after a month of data exists |
| Business CRM depth, AI review assistant, calendar | later |

---|---|
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

**Eight categories, two scores, one gated number.** Each category — Deen,
Discipline, Health, Work, Family, Financial, Growth, Business — is scored
0–100% from its own sub-metrics, every one of which reports the raw figure
behind it. Foundation blends Deen/Discipline/Health; Life Progress blends the
rest. Both are shown side by side *before* the Overall number, always.

**The gate is applied unconditionally, and this was a deliberate change from
the spec.** The specification asked for:

```
Overall = F×0.6 + L×0.4
IF F < 40%:  Overall = MIN(Overall, F + 15)
```

That threshold creates a discontinuity. At L=90%, a Foundation of 39% yields
54.0 while 41% yields 60.6 — two points of Foundation buying 6.6 points of
Overall, and the marginal value of Foundation *inverting* right at the boundary.
Dropping the `IF` fixes it:

```
Overall = MIN(F×0.6 + L×0.4,  F + 15)
```

The ceiling now binds exactly when `L > F + offset/(1−share)` — 37.5 points at
the defaults, i.e. only on the productive-but-collapsed days it was written for
— and the two branches meet continuously at that point, so there is no cliff
anywhere. A perfect day still reaches 100. A test sweeps F from 0 to 100 at
every L and asserts no step exceeds one point.

**Learning is capped until it is applied.** Three hours of learning with no
application scores 40% of the Growth category; thirty minutes that you actually
used scores 100%. This is the guard against productive procrastination.

**Work measures value, not hours.** Raw hours worked is recorded but is
deliberately *not* a sub-metric of the Work score. A test asserts it never
becomes one.

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

**Recovery plans expire in 24 hours.** Unfinished items lapse rather than
stacking into a backlog of guilt — with one exception: an unfinished *Deen*
action carries over exactly once, then lapses too. The hierarchy is honoured
without anything accumulating.

**Streaks never punish.** Current and longest are tracked separately. A missed
day sets the current streak to zero but can never erase the longest — what you
did happened, and it stays on the record.

**Blanks are not zeros until the day is closed.** While a day is still running,
an unlogged category is excluded and the remaining weights renormalise, so a
morning is not scored as a failure. Once you close the day, a blank counts as
zero — you were asked, and you left it.

**Business is a module, not a feature.** ChnoKain is one row in a projects
table, seeded at signup with its own priority tier and weekly target. The next
venture is another row, not a code change.

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
  lib/categories.ts  Eight category scorers. Pure, every sub-metric self-describing
  lib/scoring.ts     Roll-up, the Foundation gate, day evaluation, streaks
  lib/patterns.ts    Gated correlation reporting
  lib/data.ts        Loading and persistence
  app/               Dashboard, check-in, muhasabah, reset, insights, settings
tests/               103 tests, no framework — plain Node
```

Domain logic is pure and separate from the UI, so the rules that judge your day
can be read, argued with and tested without running the app.

---

*A bad day is allowed. A delayed return is the real danger. Restart today.*
