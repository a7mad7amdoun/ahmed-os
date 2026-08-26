import type { DaySnapshot } from "./data";
import { PRAYER_LABELS } from "./prayer-times";

export type NextAction = {
  text: string;
  why: string;
  href?: string;
  urgency: "now" | "today" | "calm";
};

/* One instruction, chosen by priority: Deen → foundation →
   responsibility → growth. Never a list of fifty things. */
export function nextAction(s: DaySnapshot): NextAction {
  const now = s.now;

  // 1. An obligatory prayer whose time is in and which isn't logged.
  for (const w of s.windows) {
    if (now < w.start || now >= w.end) continue;
    const row = s.prayers.find((p) => p.prayer === w.prayer);
    if (row && row.status === "not_logged") {
      const mins = Math.round((w.onTimeUntil.getTime() - now.getTime()) / 60000);
      return {
        text: `Pray ${PRAYER_LABELS[w.prayer].en}`,
        why: mins > 0
          ? `${mins} min left in the on-time window.`
          : `The window is open. Praying it now still counts as prayed.`,
        urgency: "now",
      };
    }
  }

  // 2. Today's stated priority, still open.
  if (s.day.topPriority && !s.day.topPriorityDone) {
    return {
      text: s.day.topPriority,
      why: "The one task you named as today's most important.",
      href: "/check-in",
      urgency: "today",
    };
  }

  // 3. Qur'an, once the day is underway.
  const pages = s.quran ? Number(s.quran.pages) : 0;
  if (pages <= 0 && s.elapsed >= 2) {
    const goal = Number(s.settings.quranGoalPages);
    return {
      text: `Read ${goal} page${goal === 1 ? "" : "s"} of Qur'an`,
      why: "Not opened today. One page counts; consistency is the goal, not volume.",
      href: "/check-in",
      urgency: "today",
    };
  }

  // 4. No priority named yet.
  if (!s.day.topPriority && s.elapsed >= 1) {
    return {
      text: "Name today's most important task",
      why: "A day without a stated priority tends to be filled by whatever is easiest.",
      href: "/check-in",
      urgency: "today",
    };
  }

  // 5. Close the day honestly.
  if (s.elapsed >= 5 && !s.day.checkedInAt) {
    return {
      text: "Complete today's check-in",
      why: "Isha has entered. Closing the day takes about two minutes.",
      href: "/check-in",
      urgency: "today",
    };
  }
  if (s.day.checkedInAt && !s.reflection) {
    return {
      text: "Write tonight's Muhasabah",
      why: "The day is logged. The accounting is what makes it useful.",
      href: "/muhasabah",
      urgency: "calm",
    };
  }

  const next = s.windows.find((w) => now < w.start);
  return {
    text: next ? `Be ready for ${PRAYER_LABELS[next.prayer].en}` : "The day is accounted for",
    why: next
      ? "Nothing outstanding. Keep the next prayer in view."
      : "Everything logged. Rest, and protect tomorrow's Fajr by sleeping early.",
    urgency: "calm",
  };
}
