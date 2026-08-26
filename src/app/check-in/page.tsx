import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { loadDay, loadSettings } from "@/lib/data";
import { todayIn, fmtLongDate } from "@/lib/dates";
import { saveCheckIn } from "@/app/actions";
import { Shell } from "@/components/ui";
import { Check, Field, Group } from "@/components/Check";
import PracticeToggles from "./PracticeToggles";

export const dynamic = "force-dynamic";

function hhmmLocal(d: Date | null | undefined, tz: string) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export default async function CheckIn({
  searchParams,
}: { searchParams: Promise<{ date?: string }> }) {
  const { userId } = await requirePage();
  const settings = await loadSettings(userId);
  const sp = await searchParams;
  const today = todayIn(settings.timezone);
  const date = sp.date ?? today;
  const s = await loadDay(userId, date);
  const d = s.day;

  return (
    <Shell active="/check-in">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.4rem]">Daily check-in</h1>
        <p className="mt-1 text-[0.8rem] text-[var(--color-faint)]">
          {fmtLongDate(date, settings.timezone)} · mostly taps, three things to write. Two minutes.
        </p>
      </header>

      <div className="mb-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3.5">
        <p className="text-[0.82rem] text-[var(--color-muted)]">
          Prayers are logged on the dashboard as they happen, not here — timing them after the fact
          defeats the point.{" "}
          <Link href="/" className="text-[var(--color-deen)] hover:underline">Open prayer log →</Link>
        </p>
      </div>

      <form action={saveCheckIn} className="space-y-5">
        <input type="hidden" name="date" value={date} />

        <Group title="Qur'an" ar="القرآن" note="Consistency, not volume. One page logged beats one page intended.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pages read" hint={`Goal: ${Number(settings.quranGoalPages)}/day`}>
              <input name="quranPages" type="number" step="0.5" min="0" inputMode="decimal"
                defaultValue={s.quran ? String(Number(s.quran.pages)) : ""} placeholder="0" />
            </Field>
            <Field label="Surah / position">
              <input name="quranSurah" defaultValue={s.quran?.surah ?? ""} placeholder="e.g. Al-Mulk" />
            </Field>
            <Field label="Memorisation" ar="حفظ">
              <input name="quranMemorization" defaultValue={s.quran?.memorization ?? ""} placeholder="Optional" />
            </Field>
          </div>
          <Field label="One thing that stayed with you">
            <textarea name="quranReflection" defaultValue={s.quran?.reflection ?? ""}
              placeholder="A verse, a meaning, a thought. Leave blank if nothing." />
          </Field>
        </Group>

        <PracticeToggles date={date} defs={s.practiceDefs as any} rows={s.practices as any} />

        <Group title="Sleep & body" note="A floor, not a fitness programme.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Went to sleep" hint="Times after 18:00 count as the night before.">
              <input name="sleptAt" type="time" defaultValue={hhmmLocal(s.sleep?.sleptAt, settings.timezone)} />
            </Field>
            <Field label="Woke up">
              <input name="wokeAt" type="time" defaultValue={hhmmLocal(s.sleep?.wokeAt, settings.timezone)} />
            </Field>
            <Field label="Energy (1–5)">
              <select name="energy" defaultValue={d.energy ?? ""}>
                <option value="">—</option>
                <option value="1">1 · empty</option>
                <option value="2">2 · tired</option>
                <option value="3">3 · functional</option>
                <option value="4">4 · good</option>
                <option value="5">5 · sharp</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Check name="movement" label="Moved my body" defaultChecked={d.movement}
              hint="A walk counts. This is not a gym requirement." />
            <Check name="hygiene" label="Kept myself clean and presentable" defaultChecked={d.hygiene} />
          </div>
        </Group>

        <Group title="Work" note="Hours worked ≠ value created. This section is weighted accordingly.">
          <Field label="Most important task today">
            <input name="topPriority" defaultValue={d.topPriority ?? ""}
              placeholder="The one that actually mattered" />
          </Field>
          <Check name="topPriorityDone" label="I completed it" defaultChecked={d.topPriorityDone} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deep, focused hours" hint="Uninterrupted only. Be honest — the number is for you.">
              <input name="deepWorkHours" type="number" step="0.5" min="0" max="16" inputMode="decimal"
                defaultValue={d.deepWorkMinutes === null ? "" : String(d.deepWorkMinutes / 60)} placeholder="0" />
            </Field>
            <Field label="Total hours worked">
              <input name="workHours" type="number" step="0.5" min="0" max="18" inputMode="decimal"
                defaultValue={d.workMinutes === null ? "" : String(d.workMinutes / 60)} placeholder="0" />
            </Field>
          </div>
          <Field label="What did I actually deliver?">
            <input name="valueCreated" defaultValue={d.valueCreated ?? ""}
              placeholder="Something real, not 'worked on things'" />
          </Field>
          <Field label="What did I avoid today?" hint="Naming avoidance is how it stops being invisible.">
            <input name="avoidedTask" defaultValue={d.avoidedTask ?? ""} placeholder="The thing you kept postponing" />
          </Field>
        </Group>

        <Group title="Discipline & integrity" note="Self-reported. The app cannot verify these — you can.">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Check name="keptPromises" label="Kept my promises" defaultChecked={d.keptPromises} />
            <Check name="wasHonest" label="Was honest today" defaultChecked={d.wasHonest} />
            <Check name="madeExcuses" label="I made excuses" defaultChecked={d.madeExcuses}
              hint="Checking this costs nothing. Hiding it costs everything." />
          </div>
        </Group>

        <Group title="Family" ar="الأهل">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Check name="familyContact" label="Real interaction with family" defaultChecked={d.familyContact}
              hint="Present, not just in the same room." />
            <Check name="familyResponsibility" label="Fulfilled a responsibility toward them"
              defaultChecked={d.familyResponsibility} />
          </div>
          <Field label="Anything worth remembering">
            <input name="familyNote" defaultValue={d.familyNote ?? ""} placeholder="Optional" />
          </Field>
        </Group>

        <Group title="Learning & money" note="Learning counts halfway until it is applied.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minutes learning">
              <input name="learningMinutes" type="number" min="0" max="900" inputMode="numeric"
                defaultValue={d.learningMinutes === null ? "" : String(d.learningMinutes)} placeholder="0" />
            </Field>
            <Field label="Unnecessary spending (MAD)" hint="Leave blank if you did not track it today.">
              <input name="unnecessarySpend" type="number" step="1" min="0" inputMode="decimal"
                defaultValue={d.unnecessarySpend === null ? "" : String(Number(d.unnecessarySpend))} placeholder="" />
            </Field>
          </div>
          <Check name="learningApplied" label="I used what I learned on something real"
            defaultChecked={d.learningApplied}
            hint="The guard against learning as a way of avoiding work." />
        </Group>

        <div className="flex flex-wrap items-center gap-3 pb-4">
          <button type="submit"
            className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
            Save check-in
          </button>
          <Link href="/muhasabah" className="text-[0.8rem] text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Skip to Muhasabah →
          </Link>
          {d.checkedInAt && (
            <span className="text-[0.75rem] text-[var(--color-faint)]">
              Already checked in today — saving updates it.
            </span>
          )}
        </div>
      </form>
    </Shell>
  );
}
