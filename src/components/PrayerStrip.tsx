"use client";

import { useTransition } from "react";
import { logPrayer, togglePrayerFlag, type PrayerAction } from "@/app/actions";
import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayer-times";

type Row = {
  prayer: PrayerKey;
  status: "not_logged" | "on_time" | "late" | "missed";
  jamaah: boolean;
  mosque: boolean;
  manualOverride: boolean;
  startISO: string;
  onTimeUntilISO: string;
  endISO: string;
  due: boolean;
  windowClosed: boolean;
};

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  on_time:    { dot: "var(--color-deen)",  text: "var(--color-deen)",  label: "On time" },
  late:       { dot: "var(--color-warn)",  text: "var(--color-warn)",  label: "Late" },
  missed:     { dot: "var(--color-alert)", text: "var(--color-alert)", label: "Missed" },
  not_logged: { dot: "var(--color-line)",  text: "var(--color-faint)", label: "—" },
};

function hhmm(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export default function PrayerStrip({ date, rows, tz, editable }: {
  date: string; rows: Row[]; tz: string; editable: boolean;
}) {
  const [pending, start] = useTransition();

  const act = (prayer: PrayerKey, action: PrayerAction) =>
    start(() => { logPrayer(date, prayer, action); });
  const flag = (prayer: PrayerKey, f: "jamaah" | "mosque") =>
    start(() => { togglePrayerFlag(date, prayer, f); });

  return (
    <div className={pending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      {rows.map((r) => {
        const s = STATUS_STYLE[r.status];
        const prayed = r.status === "on_time" || r.status === "late";
        const L = PRAYER_LABELS[r.prayer];
        return (
          <div key={r.prayer}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-line-soft)] px-5 py-3 last:border-b-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.dot }} />

            <div className="flex min-w-[7.5rem] items-baseline gap-2">
              <span className="text-[0.9rem] font-medium">{L.en}</span>
              <span className="ar text-[0.95rem] text-[var(--color-faint)]">{L.ar}</span>
            </div>

            <div className="tnum min-w-[8.5rem] text-[0.78rem] text-[var(--color-faint)]">
              {hhmm(r.startISO, tz)}
              <span className="mx-1 text-[var(--color-line)]">·</span>
              <span title="On-time window">on time to {hhmm(r.onTimeUntilISO, tz)}</span>
            </div>

            <span className="min-w-[4.5rem] text-[0.78rem]" style={{ color: s.text }}>
              {r.status === "not_logged" && !r.due ? "Not yet" : s.label}
              {r.manualOverride && prayed && (
                <span className="ml-1 text-[var(--color-faint)]" title="Logged by hand, not timed">*</span>
              )}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {prayed && (
                <>
                  <Toggle on={r.jamaah} onClick={() => flag(r.prayer, "jamaah")} disabled={!editable}
                    label="Jamā'ah" ar="جماعة" />
                  <Toggle on={r.mosque} onClick={() => flag(r.prayer, "mosque")} disabled={!editable}
                    label="Mosque" ar="مسجد" />
                  <Btn onClick={() => act(r.prayer, "clear")} disabled={!editable} subtle>Undo</Btn>
                </>
              )}

              {!prayed && r.due && r.status !== "missed" && (
                <>
                  <Btn onClick={() => act(r.prayer, "prayed_now")} disabled={!editable} primary>
                    Prayed now
                  </Btn>
                  <Btn onClick={() => act(r.prayer, "on_time")} disabled={!editable} subtle>Was on time</Btn>
                  <Btn onClick={() => act(r.prayer, "late")} disabled={!editable} subtle>Late</Btn>
                  {r.windowClosed && (
                    <Btn onClick={() => act(r.prayer, "missed")} disabled={!editable} subtle>Missed</Btn>
                  )}
                </>
              )}

              {r.status === "missed" && (
                <Btn onClick={() => act(r.prayer, "late")} disabled={!editable} subtle>
                  Prayed it late
                </Btn>
              )}

              {!r.due && (
                <span className="text-[0.75rem] text-[var(--color-faint)]">
                  enters {hhmm(r.startISO, tz)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, subtle }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  primary?: boolean; subtle?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded px-2.5 py-1 text-[0.75rem] transition-colors disabled:opacity-40 ${
        primary
          ? "bg-[var(--color-deen-dim)] text-[var(--color-text)] hover:bg-[var(--color-deen)]/40"
          : subtle
            ? "border border-[var(--color-line)] text-[var(--color-faint)] hover:border-[var(--color-deen-dim)] hover:text-[var(--color-muted)]"
            : "border border-[var(--color-line)] text-[var(--color-muted)]"}`}>
      {children}
    </button>
  );
}

function Toggle({ on, onClick, disabled, label, ar }: {
  on: boolean; onClick: () => void; disabled?: boolean; label: string; ar: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded px-2.5 py-1 text-[0.75rem] transition-colors disabled:opacity-40 ${
        on ? "border border-[var(--color-deen-dim)] bg-[var(--color-deen-dim)]/30 text-[var(--color-deen)]"
           : "border border-[var(--color-line)] text-[var(--color-faint)] hover:text-[var(--color-muted)]"}`}>
      {label}<span className="ar ml-1">{ar}</span>
    </button>
  );
}
