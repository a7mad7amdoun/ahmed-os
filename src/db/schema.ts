import {
  pgTable, serial, text, integer, boolean, timestamp, date, jsonb,
  numeric, uniqueIndex, index, pgEnum,
} from "drizzle-orm/pg-core";

/* ─────────────────────────────────────────────────────────────
   Ahmed OS — schema
   Design rule: obligatory acts live in their own tables with
   their own vocabulary. Optional acts are rows in `practices`.
   They are NEVER mixed, so a missed Sunnah can never visually
   or numerically stand in for a missed Fard.
   ───────────────────────────────────────────────────────────── */

export const prayerName = pgEnum("prayer_name", [
  "fajr", "dhuhr", "asr", "maghrib", "isha",
]);

// not_logged is distinct from missed: silence is not a confession,
// but it is also not forgiveness. The dashboard keeps it open.
export const prayerStatus = pgEnum("prayer_status", [
  "not_logged", "on_time", "late", "missed",
]);

export const reviewScope = pgEnum("review_scope", [
  "daily", "weekly", "monthly", "quarterly", "biannual", "yearly",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  passcodeHash: text("passcode_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  city: text("city").notNull().default("Tetouan"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull().default("35.578500"),
  longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull().default("-5.368400"),
  timezone: text("timezone").notNull().default("Africa/Casablanca"),
  // Moroccan Ministry of Habous defaults. Editable — the app never
  // hides which angles produced the times it judges you against.
  fajrAngle: numeric("fajr_angle", { precision: 4, scale: 1 }).notNull().default("19.0"),
  ishaAngle: numeric("isha_angle", { precision: 4, scale: 1 }).notNull().default("17.0"),
  madhab: text("madhab").notNull().default("Shafi"),
  // "On time" = prayed within this many minutes of the prayer entering.
  // Transparent and adjustable rather than a hidden judgement.
  onTimeWindowMinutes: integer("on_time_window_minutes").notNull().default(30),
  quranGoalPages: numeric("quran_goal_pages", { precision: 5, scale: 1 }).notNull().default("1.0"),
  sleepGoalHours: numeric("sleep_goal_hours", { precision: 3, scale: 1 }).notNull().default("7.0"),
  weeklyReviewWeekday: integer("weekly_review_weekday").notNull().default(5), // Friday
});

/* One row per calendar day. The spine everything else hangs from. */
export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),

  energy: integer("energy"),                       // 1–5
  topPriority: text("top_priority"),
  topPriorityDone: boolean("top_priority_done"),
  deepWorkMinutes: integer("deep_work_minutes"),
  workMinutes: integer("work_minutes"),
  valueCreated: text("value_created"),
  avoidedTask: text("avoided_task"),               // biggest avoidance behaviour

  keptPromises: boolean("kept_promises"),
  wasHonest: boolean("was_honest"),
  madeExcuses: boolean("made_excuses"),

  familyContact: boolean("family_contact"),
  familyResponsibility: boolean("family_responsibility"),
  familyNote: text("family_note"),

  movement: boolean("movement"),
  hygiene: boolean("hygiene"),

  learningMinutes: integer("learning_minutes"),
  learningApplied: boolean("learning_applied"),

  unnecessarySpend: numeric("unnecessary_spend", { precision: 10, scale: 2 }),

  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("days_user_date_idx").on(t.userId, t.date),
  index("days_date_idx").on(t.date),
]);

/* ── Obligatory. Its own table, deliberately. ── */
export const prayers = pgTable("prayers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  prayer: prayerName("prayer").notNull(),
  status: prayerStatus("status").notNull().default("not_logged"),
  prayedAt: timestamp("prayed_at", { withTimezone: true }),
  jamaah: boolean("jamaah").notNull().default(false),
  mosque: boolean("mosque").notNull().default(false),
  // Derived status can be overridden by hand (for prayers logged after
  // the fact); we record that so analytics can tell the two apart.
  manualOverride: boolean("manual_override").notNull().default(false),
  note: text("note"),
}, (t) => [
  uniqueIndex("prayers_user_date_prayer_idx").on(t.userId, t.date, t.prayer),
  index("prayers_user_date_idx").on(t.userId, t.date),
]);

/* ── Optional. Separate table so it can never mask the above. ── */
export const practices = pgTable("practices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  key: text("key").notNull(),            // references practiceDefs.key
  done: boolean("done").notNull().default(false),
  count: integer("count"),
}, (t) => [
  uniqueIndex("practices_user_date_key_idx").on(t.userId, t.date, t.key),
]);

export const practiceDefs = pgTable("practice_defs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  labelAr: text("label_ar"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (t) => [uniqueIndex("practice_defs_user_key_idx").on(t.userId, t.key)]);

export const quranEntries = pgTable("quran_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  pages: numeric("pages", { precision: 5, scale: 1 }).notNull().default("0"),
  surah: text("surah"),
  fromAyah: text("from_ayah"),
  toAyah: text("to_ayah"),
  reflection: text("reflection"),
  memorization: text("memorization"),
}, (t) => [uniqueIndex("quran_user_date_idx").on(t.userId, t.date)]);

export const sleepEntries = pgTable("sleep_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),          // the day you WOKE UP on
  sleptAt: timestamp("slept_at", { withTimezone: true }),
  wokeAt: timestamp("woke_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  quality: integer("quality"),           // 1–5
}, (t) => [uniqueIndex("sleep_user_date_idx").on(t.userId, t.date)]);

/* Muhasabah. jsonb answers so questions can evolve without migrations. */
export const reflections = pgTable("reflections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  scope: reviewScope("scope").notNull().default("daily"),
  answers: jsonb("answers").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("reflections_user_date_scope_idx").on(t.userId, t.date, t.scope)]);

/* Promises made, so the weekly review can confront them. */
export const commitments = pgTable("commitments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  madeOn: date("made_on").notNull(),
  dueOn: date("due_on"),
  area: text("area").notNull().default("deen"),
  status: text("status").notNull().default("open"),   // open | kept | broken | dropped
  closedOn: date("closed_on"),
  sourceReset: integer("source_reset"),
}, (t) => [index("commitments_user_status_idx").on(t.userId, t.status)]);

/* The Reset Protocol. */
export const resets = pgTable("resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  trigger: text("trigger"),               // manual | low_foundation | missed_days
  whatHappened: text("what_happened"),
  realCause: text("real_cause"),
  canControl: text("can_control"),
  smallestAction: text("smallest_action"),
  plan: jsonb("plan").notNull().default([]),   // [{area,text,done}]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("resets_user_date_idx").on(t.userId, t.date)]);
