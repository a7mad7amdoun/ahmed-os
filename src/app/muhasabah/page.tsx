import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadDay } from "@/lib/data";
import { getDb, schema } from "@/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { todayIn, fmtLongDate } from "@/lib/dates";
import { saveReflection } from "@/app/actions";
import { Shell } from "@/components/ui";

export const dynamic = "force-dynamic";

/* Muhasabah — self-accounting, not a mood journal. The questions are
   fixed and uncomfortable on purpose; answers are stored as jsonb so
   the set can change without a migration. */
const QUESTIONS: { key: string; q: string; ar?: string; hint?: string; long?: boolean }[] = [
  { key: "allah", q: "How was my relationship with Allah today?", ar: "مع الله", long: true },
  { key: "obligations", q: "Did I fulfil my obligations?" },
  { key: "promises", q: "Did I keep my promises?" },
  { key: "people", q: "Did I treat people well?" },
  { key: "family", q: "Did I neglect my parents or family?", ar: "الوالدين" },
  { key: "honesty", q: "Did I lie or behave dishonestly?", hint: "Including to yourself." },
  { key: "excuses", q: "What excuse did I use today?" },
  { key: "gratitude", q: "What am I grateful for?", ar: "الحمد لله" },
  { key: "repent", q: "What do I need to repent from?", ar: "التوبة", long: true,
    hint: "This is between you and Allah. Nothing here is scored, counted, or shown anywhere else." },
  { key: "tomorrow", q: "One thing I will do better tomorrow.", long: true },
];

export default async function Muhasabah() {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const today = todayIn(settings.timezone);
  const s = await loadDay(userId, today);
  const db = await getDb();

  const previous = await db.select().from(schema.reflections)
    .where(and(eq(schema.reflections.userId, userId), eq(schema.reflections.scope, "daily"),
               lt(schema.reflections.date, today)))
    .orderBy(desc(schema.reflections.date)).limit(3);

  const answers = (s.reflection?.answers ?? {}) as Record<string, string>;

  return (
    <Shell active="/muhasabah">
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Muhasabah</h1>
          <span className="ar text-[1.15rem] text-[var(--color-deen)]">محاسبة النفس</span>
        </div>
        <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
          {fmtLongDate(today, settings.timezone)}. Answer only what you can answer honestly — a blank is
          more useful than something written to look good. None of this is scored.
        </p>
      </header>

      <form action={saveReflection} className="space-y-4">
        <input type="hidden" name="_form" value="muhasabah" />
        <input type="hidden" name="date" value={today} />

        {QUESTIONS.map((q) => (
          <div key={q.key} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
            <label htmlFor={`q_${q.key}`} className="block text-[0.88rem] leading-snug text-[var(--color-text)]">
              {q.q}
              {q.ar && <span className="ar ml-2 text-[var(--color-faint)]">{q.ar}</span>}
            </label>
            {q.hint && <p className="mt-1 text-[0.72rem] leading-snug text-[var(--color-faint)]">{q.hint}</p>}
            {q.long ? (
              <textarea id={`q_${q.key}`} name={`q_${q.key}`} defaultValue={answers[q.key] ?? ""} className="mt-2.5" />
            ) : (
              <input id={`q_${q.key}`} name={`q_${q.key}`} defaultValue={answers[q.key] ?? ""} className="mt-2.5" />
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 pb-2">
          <button type="submit"
            className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
            Save reflection
          </button>
          <Link href="/" className="text-[0.8rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Back to dashboard
          </Link>
        </div>
      </form>

      {previous.length > 0 && (
        <section className="mt-9">
          <h2 className="text-[0.78rem] tracking-[0.1em] uppercase text-[var(--color-faint)]">Recent entries</h2>
          <div className="mt-3 space-y-3">
            {previous.map((p: any) => {
              const a = p.answers as Record<string, string>;
              const shown = QUESTIONS.filter((q) => a[q.key]).slice(0, 2);
              return (
                <div key={p.id} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3.5">
                  <p className="text-[0.72rem] text-[var(--color-faint)]">
                    {fmtLongDate(p.date, settings.timezone)}
                  </p>
                  {shown.length === 0 ? (
                    <p className="mt-1.5 text-[0.8rem] text-[var(--color-faint)]">No answers recorded.</p>
                  ) : shown.map((q) => (
                    <p key={q.key} className="mt-1.5 text-[0.82rem] leading-relaxed">
                      <span className="text-[var(--color-faint)]">{q.q} </span>
                      {a[q.key]}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-8 pb-8 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
        This section is private and stays on your own database. It is never analysed for patterns,
        never summarised, and never used in any score.
      </p>
    </Shell>
  );
}
