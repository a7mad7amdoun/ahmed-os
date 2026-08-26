/* All "today" logic is timezone-anchored to the user's city, never
   to the server. A Vercel lambda in Virginia must not decide that
   Ahmed's day has ended. */

export type ISODate = string; // YYYY-MM-DD

export function todayIn(tz: string, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((pb - pa) / 86_400_000);
}

/** Local wall-clock parts of an instant, in the given timezone. */
export function partsIn(tz: string, at: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

export function fmtTime(at: Date | null | undefined, tz: string): string {
  if (!at) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(at);
}

export function fmtLongDate(iso: ISODate, tz: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function hijriDate(iso: ISODate): string {
  const [y, m, d] = iso.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  } catch {
    return "";
  }
}

/** Start of the review week (default Saturday, so Friday closes it). */
export function weekStart(iso: ISODate, reviewWeekday = 5): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const startDow = (reviewWeekday + 1) % 7;
  const back = (dow - startDow + 7) % 7;
  return addDays(iso, -back);
}
