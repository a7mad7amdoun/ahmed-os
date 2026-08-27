import { requirePage } from "@/lib/page-auth";
import { loadSettings, loadScoringSettings, loadScoringConfig } from "@/lib/data";
import { saveSettings, saveWeights, logout } from "@/app/actions";
import { derivedShares } from "@/lib/scoring";
import { CATEGORIES, CATEGORY_LABELS, FOUNDATION_CATEGORIES } from "@/lib/categories";
import { Shell, Card, CardHead } from "@/components/ui";
import { Field } from "@/components/Check";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: { searchParams: Promise<{ saved?: string }> }) {
  const { userId, name } = await requirePage();
  const s = await loadSettings(userId);
  const scoring = await loadScoringSettings(userId);
  const cfg = await loadScoringConfig(userId);
  const sp = await searchParams;
  const totalWeight = CATEGORIES.reduce((a, k) => a + scoring.weights[k], 0);
  const shares = derivedShares(scoring.weights);

  return (
    <Shell active="/settings">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-[1.5rem]">Settings</h1>
        <p className="mt-1.5 text-[0.82rem] text-[var(--color-faint)]">
          Signed in as {name}.
        </p>
      </header>

      {sp.saved && (
        <p className="mb-5 rounded border border-[var(--color-deen-dim)] bg-[var(--color-deen-dim)]/20 px-4 py-2.5 text-[0.82rem] text-[var(--color-deen)]">
          Saved.
        </p>
      )}

      <form action={saveSettings} className="space-y-5">
        <input type="hidden" name="_form" value="settings" />
        <Card>
          <CardHead title="Prayer times"
            sub="These values decide what counts as on time" />
          <div className="space-y-4 px-5 py-4">
            <p className="text-[0.78rem] leading-relaxed text-[var(--color-faint)]">
              Times are computed locally from your coordinates — nothing is requested from any server.
              The defaults are the Moroccan Ministry of Habous angles (Fajr 19°, Isha 17°). If your
              mosque's timetable differs, adjust the angles until they match; the app should agree with
              the masjid you actually pray in.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City"><input name="city" defaultValue={s.city} /></Field>
              <Field label="Latitude"><input name="latitude" type="number" step="0.0001" defaultValue={Number(s.latitude)} /></Field>
              <Field label="Longitude"><input name="longitude" type="number" step="0.0001" defaultValue={Number(s.longitude)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Timezone"><input name="timezone" defaultValue={s.timezone} /></Field>
              <Field label="Fajr angle"><input name="fajrAngle" type="number" step="0.5" defaultValue={Number(s.fajrAngle)} /></Field>
              <Field label="Isha angle"><input name="ishaAngle" type="number" step="0.5" defaultValue={Number(s.ishaAngle)} /></Field>
              <Field label="Asr method">
                <select name="madhab" defaultValue={s.madhab}>
                  <option value="Shafi">Standard (Shafi'i / Maliki)</option>
                  <option value="Hanafi">Hanafi</option>
                </select>
              </Field>
            </div>
            <Field label="On-time window (minutes)"
              hint="How long after a prayer enters it still counts as on time. This is your own standard, not a ruling.">
              <input name="onTimeWindowMinutes" type="number" min="5" max="120" defaultValue={s.onTimeWindowMinutes} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHead title="Goals" sub="Kept deliberately small" />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Qur'an pages per day"
              hint="Start at one. Raise it only after a month of holding it.">
              <input name="quranGoalPages" type="number" step="0.5" min="0.5" defaultValue={Number(s.quranGoalPages)} />
            </Field>
            <Field label="Target sleep (hours)">
              <input name="sleepGoalHours" type="number" step="0.5" min="4" max="12" defaultValue={Number(s.sleepGoalHours)} />
            </Field>
          </div>
        </Card>

        <button type="submit"
          className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
          Save settings
        </button>
      </form>


      <form action={saveWeights} className="mt-5 space-y-5">
        <input type="hidden" name="_form" value="weights" />
        <Card>
          <CardHead title="Category weights"
            sub={`total ${totalWeight}`} />
          <div className="px-5 py-4">
            <p className="mb-4 text-[0.78rem] leading-relaxed text-[var(--color-faint)]">
              These decide how much each category moves your scores. They are stored in the database,
              not the code, so tuning them after a few weeks of real data changes nothing else. The
              weights need not sum to 100 — each group is normalised against its own total.
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              {CATEGORIES.map((k) => (
                <div key={k}>
                  <label htmlFor={`w_${k}`}>
                    {CATEGORY_LABELS[k].en}
                    <span className="ml-1.5 text-[0.65rem] text-[var(--color-faint)]">
                      {FOUNDATION_CATEGORIES.includes(k) ? "foundation" : "life"}
                    </span>
                  </label>
                  <input id={`w_${k}`} name={`w_${k}`} type="number" min="0" step="1"
                    defaultValue={scoring.weights[k]} className="mt-1.5" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="The Foundation gate" sub="How a weak foundation caps the day" />
          <div className="px-5 py-4">
            <p className="mb-4 text-[0.78rem] leading-relaxed text-[var(--color-faint)]">
              Overall is one weighted mean of all eight categories at the weights above — there is
              no second blend layered on top of them, so the weight you set is the weight that
              applies. Those weights currently put{" "}
              <strong className="text-[var(--color-ink)]">
                {Math.round(shares.foundationShare * 100)}%
              </strong>{" "}
              of the day in Foundation and {Math.round(shares.lifeShare * 100)}% in Life Progress.
              The result is then capped at Foundation + offset. The cap applies unconditionally
              rather than past a threshold, which keeps the score continuous — a threshold would make
              Overall jump either side of the boundary and invert the value of Foundation exactly
              where it should be steadiest. It binds only when Life Progress exceeds Foundation by
              more than{" "}
              {Math.round((scoring.gateCapOffset / (shares.lifeShare || 1)) * 10) / 10}{" "}
              points.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Gate cap offset" hint="Ceiling = Foundation% + this">
                <input name="gateCapOffset" type="number" step="1" min="0" max="50"
                  defaultValue={scoring.gateCapOffset} />
              </Field>
              <Field label="Deep work target (hours)">
                <input name="deepWorkTargetHours" type="number" step="0.5" min="0.5" max="10"
                  defaultValue={cfg.deepWorkTargetMinutes / 60} />
              </Field>
              <Field label="Learning target (minutes)">
                <input name="learningTargetMinutes" type="number" step="5" min="5" max="480"
                  defaultValue={cfg.learningTargetMinutes} />
              </Field>
            </div>
          </div>
        </Card>

        <button type="submit"
          className="rounded bg-[var(--color-deen-dim)] px-5 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40">
          Save scoring
        </button>
      </form>

      <div className="mt-10 border-t border-[var(--color-line-soft)] pt-5 pb-10">
        <form action={logout}>
          <button type="submit"
            className="rounded border border-[var(--color-line)] px-4 py-2 text-[0.8rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-alert)] hover:text-[var(--color-alert)]">
            Sign out
          </button>
        </form>
      </div>
    </Shell>
  );
}
