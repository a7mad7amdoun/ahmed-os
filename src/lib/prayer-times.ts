import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import type { ISODate } from "./dates";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = (typeof PRAYERS)[number];

export const PRAYER_LABELS: Record<PrayerKey, { en: string; ar: string }> = {
  fajr:    { en: "Fajr",    ar: "الفجر" },
  dhuhr:   { en: "Dhuhr",   ar: "الظهر" },
  asr:     { en: "Asr",     ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha:    { en: "Isha",    ar: "العشاء" },
};

export type TimingSettings = {
  latitude: number;
  longitude: number;
  timezone: string;
  fajrAngle: number;
  ishaAngle: number;
  madhab: string;
  onTimeWindowMinutes: number;
};

export type PrayerWindow = {
  prayer: PrayerKey;
  start: Date;
  /** When the next prayer enters — the outer edge of the valid window. */
  end: Date;
  /** start + onTimeWindowMinutes. Prayed after this is "late", not sinful. */
  onTimeUntil: Date;
};

function paramsFor(s: TimingSettings) {
  // adhan ships no Morocco preset, so we build one explicitly rather
  // than silently borrowing another country's angles.
  const p = CalculationMethod.Other();
  p.fajrAngle = s.fajrAngle;
  p.ishaAngle = s.ishaAngle;
  p.madhab = s.madhab === "Hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return p;
}

export function windowsFor(iso: ISODate, s: TimingSettings): PrayerWindow[] {
  const [y, m, d] = iso.split("-").map(Number);
  const coords = new Coordinates(s.latitude, s.longitude);
  const params = paramsFor(s);
  const today = new PrayerTimes(coords, new Date(y, m - 1, d, 12), params);
  const nextDay = new Date(y, m - 1, d + 1, 12);
  const tomorrow = new PrayerTimes(coords, nextDay, params);

  const starts: Record<PrayerKey, Date> = {
    fajr: today.fajr, dhuhr: today.dhuhr, asr: today.asr,
    maghrib: today.maghrib, isha: today.isha,
  };

  return PRAYERS.map((prayer, i) => {
    const start = starts[prayer];
    // Isha's window runs to the next Fajr. (Fiqh puts the preferred
    // limit earlier; we use Fajr as the outer bound and never claim
    // otherwise in the UI.)
    const end = i < PRAYERS.length - 1 ? starts[PRAYERS[i + 1]] : tomorrow.fajr;
    return {
      prayer,
      start,
      end,
      onTimeUntil: new Date(start.getTime() + s.onTimeWindowMinutes * 60_000),
    };
  });
}

export type DerivedStatus = "on_time" | "late" | "missed" | "not_yet";

/** What the clock says, given when (or whether) it was prayed.
 *  Pure and inspectable — the UI shows the window it used. */
export function deriveStatus(
  w: PrayerWindow, prayedAt: Date | null, now: Date,
): DerivedStatus {
  if (prayedAt) {
    if (prayedAt < w.start) return "on_time"; // logged early; trust the user
    return prayedAt <= w.onTimeUntil ? "on_time" : "late";
  }
  if (now < w.start) return "not_yet";
  return now <= w.end ? "late" : "missed"; // still open = recoverable
}

export function currentPrayer(ws: PrayerWindow[], now: Date): PrayerWindow | null {
  for (const w of ws) if (now >= w.start && now < w.end) return w;
  return null;
}

export function nextPrayer(ws: PrayerWindow[], now: Date): PrayerWindow | null {
  for (const w of ws) if (now < w.start) return w;
  return null;
}
