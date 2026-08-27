"use client";

import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, LabelList, Cell,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   Chart palette.

   The UI accent colours are deliberately desaturated and FAIL as a
   series palette — green #4E9C7C against gold #B9964F sits at ΔE 13.7
   in normal vision, under the 15 floor, and both fall below the
   chroma floor. These steps are validated for the dark chart surface
   (#111614): adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.8,
   all ≥ 3:1 contrast.
   ═══════════════════════════════════════════════════════════════ */
export const VIZ = {
  s1: "#199e70",   // aqua   — Foundation, primary series
  s2: "#9085e9",   // violet — Life Progress, comparison series
  s3: "#3987e5",   // blue
  s4: "#d95926",   // orange
  s5: "#c98500",   // yellow
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  grid: "#1E2623",
  axis: "#5C635F",
  text: "#8B928D",
  surface: "#111614",
} as const;

const AXIS = { stroke: VIZ.axis, fontSize: 11, tickLine: false };
const GRID = { stroke: VIZ.grid, strokeDasharray: "0" }; // solid hairlines, never dashed

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[0.75rem] shadow-lg">
      {children}
    </div>
  );
}

function pct(v: unknown) {
  return typeof v === "number" ? `${Math.round(v)}%` : "—";
}

/* ── Radar: the eight categories, one day's shape ─────────────── */
export function CategoryRadar({ data, compare }: {
  data: { category: string; value: number | null }[];
  compare?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={VIZ.grid} />
        <PolarAngleAxis dataKey="category" tick={{ fill: VIZ.text, fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Today" dataKey="value" stroke={VIZ.s1} fill={VIZ.s1}
          fillOpacity={0.18} strokeWidth={2} dot={{ r: 3, fill: VIZ.s1, strokeWidth: 0 }} />
        {compare && (
          <Radar name="4-week average" dataKey="avg" stroke={VIZ.s2} fill={VIZ.s2}
            fillOpacity={0.08} strokeWidth={2} dot={false} />
        )}
        {compare && <Legend wrapperStyle={{ fontSize: 11, color: VIZ.text }} />}
        <Tooltip content={({ active, payload, label }) =>
          active && payload?.length ? (
            <TipBox>
              <div className="text-[var(--color-text)]">{label}</div>
              {payload.map((p) => (
                <div key={String(p.name)} className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[1px]" style={{ background: p.color }} />
                  <span className="text-[var(--color-faint)]">{p.name}</span>
                  <span className="tnum ml-auto text-[var(--color-text)]">{pct(p.value)}</span>
                </div>
              ))}
            </TipBox>
          ) : null} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Foundation vs Life Progress. One axis, both 0–100%. ─────── */
export function FoundationVsLife({ data }: {
  data: { date: string; foundation: number | null; life: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} axisLine={{ stroke: VIZ.grid }}
          tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis domain={[0, 100]} {...AXIS} axisLine={false} width={46}
          tickFormatter={(v: number) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 11, color: VIZ.text }} />
        <Tooltip cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox>
                <div className="text-[var(--color-text)]">{label}</div>
                {payload.map((p) => (
                  <div key={String(p.name)} className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px]" style={{ background: p.color }} />
                    <span className="text-[var(--color-faint)]">{p.name}</span>
                    <span className="tnum ml-auto text-[var(--color-text)]">{pct(p.value)}</span>
                  </div>
                ))}
              </TipBox>
            ) : null} />
        <Line type="monotone" dataKey="foundation" name="Foundation" stroke={VIZ.s1}
          strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
        <Line type="monotone" dataKey="life" name="Life Progress" stroke={VIZ.s2}
          strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── One category over time. Single series, so no legend box. ── */
export function CategoryTrend({ data, color = VIZ.s1 }: {
  data: { date: string; value: number | null }[]; color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} axisLine={{ stroke: VIZ.grid }}
          tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis domain={[0, 100]} {...AXIS} axisLine={false} width={46}
          tickFormatter={(v: number) => `${v}%`} />
        <Tooltip cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox><div className="text-[var(--color-text)]">{label}</div>
                <div className="tnum mt-0.5">{pct(payload[0].value)}</div></TipBox>
            ) : null} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          dot={false} activeDot={{ r: 4 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── The week's Overall, one bar a day. Status-coloured. ─────── */
export function WeeklyBars({ data }: {
  data: { day: string; value: number | null; logged: boolean }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 2, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="day" {...AXIS} axisLine={{ stroke: VIZ.grid }} />
        <YAxis domain={[0, 100]} {...AXIS} axisLine={false} width={46}
          tickFormatter={(v: number) => `${v}%`} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox><div className="text-[var(--color-text)]">{label}</div>
                <div className="tnum mt-0.5">
                  {payload[0].payload.logged ? pct(payload[0].value) : "Not logged"}
                </div></TipBox>
            ) : null} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={34}>
          {data.map((d, i) => (
            <Cell key={i} fill={!d.logged ? VIZ.grid
              : (d.value ?? 0) >= 70 ? VIZ.s1
              : (d.value ?? 0) >= 40 ? VIZ.warning : VIZ.critical} />
          ))}
          <LabelList dataKey="value" position="top"
            formatter={(v: any) => (typeof v === "number" && v > 0 ? Math.round(v) : "")}
            style={{ fill: VIZ.text, fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Qur'an, cumulative. One series, area for a single measure. ─ */
export function QuranArea({ data }: { data: { date: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id="quranFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIZ.s1} stopOpacity={0.28} />
            <stop offset="100%" stopColor={VIZ.s1} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} axisLine={{ stroke: VIZ.grid }}
          tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis {...AXIS} axisLine={false} width={46} allowDecimals={false} />
        <Tooltip cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox><div className="text-[var(--color-text)]">{label}</div>
                <div className="tnum mt-0.5">{payload[0].value} pages total</div></TipBox>
            ) : null} />
        <Area type="monotone" dataKey="total" stroke={VIZ.s1} strokeWidth={2}
          fill="url(#quranFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Where the month's income went. Genuine part-to-whole. ───── */
export function MoneyStack({ data }: {
  data: { month: string; expenses: number; debt: number; savings: number; left: number }[];
}) {
  const series = [
    { key: "expenses", name: "Expenses", color: VIZ.s4 },
    { key: "debt", name: "Debt repaid", color: VIZ.s1 },
    { key: "savings", name: "Saved", color: VIZ.s5 },
    { key: "left", name: "Left over", color: VIZ.s3 },
  ];
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="month" {...AXIS} axisLine={{ stroke: VIZ.grid }} />
        <YAxis {...AXIS} axisLine={false} width={58}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <Legend wrapperStyle={{ fontSize: 11, color: VIZ.text }} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox>
                <div className="text-[var(--color-text)]">{label}</div>
                {payload.map((p) => (
                  <div key={String(p.name)} className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px]" style={{ background: p.color }} />
                    <span className="text-[var(--color-faint)]">{p.name}</span>
                    <span className="tnum ml-auto text-[var(--color-text)]">
                      {new Intl.NumberFormat("en-GB").format(Number(p.value))}
                    </span>
                  </div>
                ))}
              </TipBox>
            ) : null} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="m" fill={s.color}
            maxBarSize={46}
            // 2px surface gap between stacked segments
            stroke={VIZ.surface} strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Sleep against its target band. One measure, one axis. ───── */
export function SleepScatter({ data, goal }: {
  data: { date: string; hours: number }[]; goal: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <ScatterChart margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} axisLine={{ stroke: VIZ.grid }} type="category"
          tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis dataKey="hours" {...AXIS} axisLine={false} width={46} domain={[0, 12]}
          tickFormatter={(v: number) => `${v}h`} />
        <ReferenceArea y1={goal - 1} y2={goal + 1} fill={VIZ.s1} fillOpacity={0.10}
          stroke={VIZ.grid} />
        <Tooltip cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox>
                <div className="text-[var(--color-text)]">{payload[0].payload.date}</div>
                <div className="tnum mt-0.5">{payload[0].payload.hours.toFixed(1)}h slept</div>
              </TipBox>
            ) : null} />
        <Scatter data={data} fill={VIZ.s1} shape="circle" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ── Category weights.
      Specified as a donut; built as a horizontal bar. A donut cannot
      carry eight segments where four sit at 5% or below — the small
      slices become unreadable and comparison by angle is guesswork.
      Bars compare exactly and hold the long labels. ─────────────── */
export function WeightsBars({ data }: {
  data: { label: string; weight: number; group: "foundation" | "life" }[];
}) {
  const max = Math.max(...data.map((d) => d.weight), 1);
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[0.78rem] text-[var(--color-muted)]">{d.label}</span>
          <span className="h-[10px] flex-1 overflow-hidden rounded-[3px] bg-[var(--color-line)]">
            <span className="block h-full rounded-[3px]"
              style={{
                width: `${(d.weight / max) * 100}%`,
                background: d.group === "foundation" ? VIZ.s1 : VIZ.s2,
              }} />
          </span>
          <span className="tnum w-8 shrink-0 text-right text-[0.75rem] text-[var(--color-faint)]">
            {d.weight}
          </span>
        </li>
      ))}
      <li className="flex items-center gap-4 pt-2 text-[0.7rem] text-[var(--color-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[1px]" style={{ background: VIZ.s1 }} />Foundation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[1px]" style={{ background: VIZ.s2 }} />Life Progress
        </span>
      </li>
    </ul>
  );
}

/* ── Prayer consistency, day × prayer. Status, so never colour
      alone: a legend names each state and every cell has a tooltip. ── */
const STATUS_FILL: Record<string, string> = {
  on_time: VIZ.good, late: VIZ.warning, missed: VIZ.critical, not_logged: VIZ.grid,
};
const STATUS_LABEL: Record<string, string> = {
  on_time: "On time", late: "Late", missed: "Missed", not_logged: "Not logged",
};

export function PrayerHeatmap({ days, prayers }: {
  days: { date: string; label: string; cells: Record<string, string> }[];
  prayers: { key: string; label: string }[];
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th className="w-16" />
              {days.map((d) => (
                <th key={d.date} className="text-[0.68rem] font-normal text-[var(--color-faint)]">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prayers.map((p) => (
              <tr key={p.key}>
                <td className="pr-2 text-right text-[0.72rem] text-[var(--color-muted)]">{p.label}</td>
                {days.map((d) => {
                  const st = d.cells[p.key] ?? "not_logged";
                  return (
                    <td key={d.date}>
                      <span
                        className="block h-6 w-full rounded-[3px]"
                        style={{ background: STATUS_FILL[st], opacity: st === "not_logged" ? 1 : 0.85 }}
                        title={`${p.label} · ${d.date} — ${STATUS_LABEL[st]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.7rem] text-[var(--color-faint)]">
        {Object.keys(STATUS_LABEL).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px]" style={{ background: STATUS_FILL[k] }} />
            {STATUS_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
