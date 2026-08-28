import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadDay, loadSettings, loadRange } from "@/lib/data";
import { todayIn, addDays } from "@/lib/dates";
import { createReset } from "@/app/actions";
import { Shell } from "@/components/ui";
import { Field } from "@/components/Check";
import ResetPlan from "./ResetPlan";

export const dynamic = "force-dynamic";

/* The causes are offered as a list because naming a cause under
   pressure is hard, and "I was lazy" is almost never the real one. */
const CAUSES = [
  "Poor sleep",
  "Woke too late",
  "Made excuses",
  "Overthinking",
  "Distraction / phone",
  "Unrealistic plan",
  "Emotional difficulty",
  "No structure to the day",
  "Avoiding difficult work",
  "Something outside my control",
];

export default async function ResetPage() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const s = await loadDay(userId, today);
  const facts = await loadRange(userId, addDays(today, -13), today);

  const missedRecently = facts.filter((f) => (f.prayersPerformed ?? 5) < 5).length;
  const gap = facts.filter((f) => !f.checkedIn).length;

  return (
    <Shell active="/reset">
      <header className="mb-6">
        <p className="text-[0.7rem] tracking-[0.12em] uppercase text-[var(--color-deen)]">Reset protocol</p>
        <h1 className="mt-1.5 font-[family-name:var(--font-serif)] text-[1.5rem] leading-snug">
          Restart today. Not Monday.
        </h1>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          A bad day is allowed. The damage is not in the day — it is in the week you spend waiting for a
          clean moment to begin again. This takes four questions and produces at most four small actions
          for the next 24 hours.
        </p>
      </header>

      {s.reset ? (
        <ResetPlan reset={{
          id: s.reset.id,
          plan: s.reset.plan as any[],
          whatHappened: s.reset.whatHappened,
          realCause: s.reset.realCause,
          smallestAction: s.reset.smallestAction,
          completedAt: s.reset.completedAt ? s.reset.completedAt.toISOString() : null,
        }} />
      ) : (
        <form action={createReset} className="space-y-5">
        <input type="hidden" name="_form" value="reset" />
          <input type="hidden" name="date" value={today} />
          <input type="hidden" name="trigger" value={s.scores.evaluation.suggestReset ? "low_foundation" : "manual"} />

          {(missedRecently > 0 || gap > 0) && (
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3.5">
              <p className="text-[0.8rem] text-[var(--color-muted)]">
                Last 14 days: {missedRecently} day{missedRecently === 1 ? "" : "s"} with an incomplete prayer record,
                {" "}{gap} day{gap === 1 ? "" : "s"} not logged at all.
              </p>
              <p className="mt-1 text-[0.75rem] text-[var(--color-faint)]">
                Stated as fact, not as an accusation. It is the pattern that matters, not the guilt.
              </p>
            </div>
          )}

          <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5 space-y-5">
            <Field label="1. What happened?" hint="Plainly. No defending yourself, no exaggerating either.">
              <textarea name="whatHappened" required placeholder="What actually went wrong today." />
            </Field>

            <div>
              <label>2. What was the real cause?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CAUSES.map((c) => (
                  <label key={c}
                    className="cursor-pointer rounded border border-[var(--color-line)] px-2.5 py-1.5 text-[0.76rem] text-[var(--color-faint)] transition-colors hover:border-[var(--color-deen-dim)] has-[:checked]:border-[var(--color-deen-dim)] has-[:checked]:bg-[var(--color-deen-dim)]/25 has-[:checked]:text-[var(--color-deen)]">
                    <input type="radio" name="realCause" value={c} className="sr-only" style={{ width: 0, padding: 0, border: 0 }} />
                    {c}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[0.7rem] text-[var(--color-faint)]">
                Pick the one that is actually true, not the one that sounds best.
              </p>
            </div>

            <Field label="3. What part of this can I control?"
              hint="Separating the two is the whole exercise. Some of it genuinely isn't yours.">
              <textarea name="canControl" placeholder="The part that was mine to decide." />
            </Field>

            <Field label="4. What is the smallest action that gets me back on track?"
              hint="Smallest. Not the most impressive.">
              <input name="smallestAction" required placeholder="e.g. Pray Isha at the mosque tonight" />
            </Field>
          </section>

          <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
            <header className="border-b border-[var(--color-line-soft)] px-5 py-3">
              <h2 className="text-[0.8rem] font-medium tracking-[0.08em] uppercase text-[var(--color-muted)]">
                Recovery plan · next 24 hours
              </h2>
              <p className="mt-1 text-[0.72rem] text-[var(--color-faint)]">
                Four slots, deliberately. Do not rebuild your entire life tonight — fix the next step.
                Leave any of them blank.
              </p>
            </header>
            <div className="space-y-4 px-5 py-4">
              <Field label="One Deen action" ar="الدين" hint="Small and certain. One prayer at the mosque, two pages, ten minutes of dhikr.">
                <input name="plan_deen" placeholder="e.g. Pray Fajr on time tomorrow" />
              </Field>
              <Field label="One responsibility" hint="Something you owe someone — work, family, a promise.">
                <input name="plan_responsibility" placeholder="e.g. Send the translation I promised" />
              </Field>
              <Field label="One health action" hint="Usually: go to sleep at a fixed time.">
                <input name="plan_health" placeholder="e.g. In bed by 23:30, phone in another room" />
              </Field>
              <Field label="One change to my environment" hint="Change the conditions, not just the intention.">
                <input name="plan_environment" placeholder="e.g. Charge the phone outside the bedroom" />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 pb-4">
            <button type="submit"
              className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
              Create recovery plan
            </button>
            <Link href="/" className="text-[0.8rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
              Back to dashboard
            </Link>
          </div>
          <p className="pb-8 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
            Each item you write becomes a recorded commitment. Friday's review will ask you about it —
            not to shame you, but because a promise nobody checks is not a promise.
          </p>
        </form>
      )}
    </Shell>
  );
}
