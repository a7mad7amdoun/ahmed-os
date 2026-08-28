/* ═══════════════════════════════════════════════════════════════
   One interaction, reused everywhere.

   Almost every sub-habit is logged with a single tap on one of six
   tiers. The wording above the tiers changes per habit; the tiers
   themselves never do. That sameness is what lets the system be
   genuinely detailed without becoming tiring to use daily.
   ═══════════════════════════════════════════════════════════════ */

export const TIERS = [
  { key: "missed",    points: 0,  label: "Missed",    meaning: "Not done at all" },
  { key: "poor",      points: 5,  label: "Poor",      meaning: "Attempted minimally" },
  { key: "partial",   points: 10, label: "Partial",   meaning: "Done partly, below your standard" },
  { key: "adequate",  points: 14, label: "Adequate",  meaning: "Done as planned" },
  { key: "good",      points: 17, label: "Good",      meaning: "Done well" },
  { key: "excellent", points: 20, label: "Excellent", meaning: "Exceeded your own standard" },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export const TIER_POINTS: Record<TierKey, number> =
  Object.fromEntries(TIERS.map((t) => [t.key, t.points])) as Record<TierKey, number>;

export function tierPoints(key: string | null | undefined): number | null {
  if (!key) return null;
  return key in TIER_POINTS ? TIER_POINTS[key as TierKey] : null;
}

/* The prayer tier is five steps rather than six, because the states a
   prayer can be in are real and specific rather than a self-judgement.
   The app derives this from the prayer log instead of asking — it
   already knows the time you prayed and whether you were at the mosque. */
export const PRAYER_TIERS = [
  { key: "missed",       points: 0,  label: "Missed" },
  { key: "late",         points: 8,  label: "Late, alone" },
  { key: "on_time",      points: 14, label: "On time, alone" },
  { key: "congregation", points: 17, label: "On time, in congregation" },
  { key: "mosque",       points: 20, label: "On time, at the mosque" },
] as const;

export type PrayerTierKey = (typeof PRAYER_TIERS)[number]["key"];

export const PRAYER_TIER_POINTS: Record<PrayerTierKey, number> =
  Object.fromEntries(PRAYER_TIERS.map((t) => [t.key, t.points])) as Record<PrayerTierKey, number>;

/** Map a logged prayer to its tier. Congregation and mosque only lift
 *  the tier when the prayer was also on time — praying late at the
 *  mosque is still a late prayer. */
export function prayerTier(
  status: "not_logged" | "on_time" | "late" | "missed",
  jamaah: boolean,
  mosque: boolean,
  windowClosed: boolean,
): { key: PrayerTierKey; points: number } | null {
  if (status === "not_logged") return windowClosed ? { key: "missed", points: 0 } : null;
  if (status === "missed") return { key: "missed", points: 0 };
  if (status === "late") return { key: "late", points: 8 };
  if (mosque) return { key: "mosque", points: 20 };
  if (jamaah) return { key: "congregation", points: 17 };
  return { key: "on_time", points: 14 };
}

/** Quantity habits skip the tier tap: you type one number and the app
 *  converts it. Never above the target — exceeding it is not a higher
 *  score, it is just exceeding it. */
export function quantityPoints(actual: number | null, target: number): number | null {
  if (actual === null || !Number.isFinite(actual)) return null;
  if (target <= 0) return null;
  return Math.round(Math.min(actual / target, 1) * 20);
}
