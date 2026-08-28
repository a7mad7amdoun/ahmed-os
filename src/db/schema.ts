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
  // Wake consistency is measured against this, +/- 30 min, then decays.
  targetWakeTime: text("target_wake_time").notNull().default("06:00"),
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
  // Counts, not booleans: the Discipline formulas subtract per
  // occurrence (excuses x20, avoidance x25).
  excusesLogged: integer("excuses_logged"),
  avoidanceFlags: integer("avoidance_flags"),
  // Punctuality needs something real to measure against; prayer
  // timing already lives in Deen and must not be double-counted.
  scheduledEvents: integer("scheduled_events"),
  onTimeEvents: integer("on_time_events"),

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
  // Plans expire after 24h so guilt cannot accumulate. An unfinished
  // Deen item is allowed to carry exactly once, then it lapses too.
  expiresOn: date("expires_on"),
  deenCarried: boolean("deen_carried").notNull().default(false),
}, (t) => [index("resets_user_date_idx").on(t.userId, t.date)]);

/* ═══════════════════════════════════════════════════════════════
   Phase 1 additions — scoring config, responsibility, money, work
   ═══════════════════════════════════════════════════════════════ */

/* Category weights live in the database, never in components, so
   tuning after a few weeks of real data needs no deploy. */
export const categoryWeights = pgTable("category_weights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),   // deen | discipline | health | work | family | financial | growth | business
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("weights_user_category_idx").on(t.userId, t.category)]);

/* Tunable scoring constants. The gate cap is here rather than in
   code precisely because it is a guess until real data tunes it. */
export const scoringConfig = pgTable("scoring_config", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  gateCapOffset: numeric("gate_cap_offset", { precision: 5, scale: 2 }).notNull().default("15"),
  deepWorkTargetMinutes: integer("deep_work_target_minutes").notNull().default(120),
  learningTargetMinutes: integer("learning_target_minutes").notNull().default(30),
  resetThresholdPct: numeric("reset_threshold_pct", { precision: 5, scale: 2 }).notNull().default("40"),
});

/* Goals: longer horizon than a commitment, and not a promise. */
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("deen"),
  targetDate: date("target_date"),
  status: text("status").notNull().default("open"),   // open | achieved | abandoned
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedOn: date("closed_on"),
}, (t) => [index("goals_user_status_idx").on(t.userId, t.status)]);

/* Businesses and projects. ChnoKain is seeded as one row here, not
   as a special case in code — there will be others. */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("C"),          // A | B | C
  status: text("status").notNull().default("active"), // active | paused | closed
  weeklyTarget: integer("weekly_target").notNull().default(3), // logged activities/week
  role: text("role"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("projects_user_status_idx").on(t.userId, t.status)]);

export const businessMetrics = pgTable("business_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  businessesContacted: integer("businesses_contacted").notNull().default(0),
  businessesVisited: integer("businesses_visited").notNull().default(0),
  meetings: integer("meetings").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  followUps: integer("follow_ups").notNull().default(0),
  revenue: numeric("revenue", { precision: 12, scale: 2 }),
  notes: text("notes"),
}, (t) => [
  index("business_user_date_idx").on(t.userId, t.date),
  index("business_project_idx").on(t.projectId),
]);

/* ── Money. Stabilise → reduce debt → save → invest → grow. ── */

export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  type: text("type").notNull(),            // income | expense | debt_payment | saving | investment
  category: text("category").notNull(),    // salary | freelance | business | essential | personal | ...
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isUnnecessary: boolean("is_unnecessary").notNull().default(false),
  debtId: integer("debt_id"),
  savingsGoalId: integer("savings_goal_id"),
  notes: text("notes"),
}, (t) => [
  index("tx_user_date_idx").on(t.userId, t.date),
  index("tx_user_type_idx").on(t.userId, t.type),
]);

export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  monthlyTarget: numeric("monthly_target", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("MAD"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MAD"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
});

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("tools"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
});

/* ── Skills, so learning must point at something real. ── */

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currentLevel: integer("current_level").notNull().default(1),
  learningGoal: text("learning_goal"),
  status: text("status").notNull().default("active"),
});

export const learningSessions = pgTable("learning_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").references(() => skills.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  minutes: integer("minutes").notNull().default(0),
  // Full credit requires this. Learning without application is the
  // productive-procrastination failure mode.
  appliedNote: text("applied_note"),
  notes: text("notes"),
}, (t) => [index("learning_user_date_idx").on(t.userId, t.date)]);

/* Cached daily roll-up. Recomputed on write; never the source of
   truth, so a scoring change can always be replayed from raw rows. */
export const dailyScores = pgTable("daily_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  categories: jsonb("categories").notNull().default({}),  // {deen: 82.5, ...}
  foundationPct: numeric("foundation_pct", { precision: 5, scale: 2 }),
  lifeProgressPct: numeric("life_progress_pct", { precision: 5, scale: 2 }),
  foundationScore: numeric("foundation_score", { precision: 4, scale: 1 }),
  lifeProgressScore: numeric("life_progress_score", { precision: 4, scale: 1 }),
  overallPct: numeric("overall_pct", { precision: 5, scale: 2 }),
  gated: boolean("gated").notNull().default(false),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("daily_scores_user_date_idx").on(t.userId, t.date)]);

export const weeklyReviews = pgTable("weekly_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  answers: jsonb("answers").notNull().default({}),
  promisesReview: jsonb("promises_review").notNull().default({}),
  biggestPriority: text("biggest_priority"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("weekly_user_week_idx").on(t.userId, t.weekStart)]);

/* ═══════════════════════════════════════════════════════════════
   V2 — caps-based scoring
   ═══════════════════════════════════════════════════════════════ */

/* One row per category per day, written the day it is calculated.
   Trends and the "why did this change?" view read from here and never
   recompute — so tuning a formula later cannot silently rewrite what
   last month looked like. */
export const categoryScoreLog = pgTable("category_score_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  category: text("category").notNull(),
  rawPoints: numeric("raw_points", { precision: 6, scale: 2 }).notNull(),
  maxPoints: numeric("max_points", { precision: 6, scale: 2 }).notNull(),
  capApplied: integer("cap_applied"),
  uncappedScore: integer("uncapped_score").notNull(),
  finalScore: integer("final_score").notNull(),
  status: text("status").notNull(),
  breakdown: jsonb("breakdown").notNull().default([]),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("score_log_user_date_cat_idx").on(t.userId, t.date, t.category),
  index("score_log_user_date_idx").on(t.userId, t.date),
]);

/* The 1–10 self-ratings that open the Life Map. Kept as history rather
   than overwritten, so "where I started" stays intact while "where I am
   now" moves. */
export const lifeRatings = pgTable("life_ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  area: text("area").notNull(),
  rating: integer("rating").notNull(),
  recordedOn: date("recorded_on").notNull(),
  isBaseline: boolean("is_baseline").notNull().default(false),
  note: text("note"),
}, (t) => [index("life_ratings_user_area_idx").on(t.userId, t.area)]);

/* Direction notes for the Life Map — deliberately framed as direction,
   never as a promised destination. */
export const directionNotes = pgTable("direction_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  horizon: text("horizon").notNull(),      // ninety_day | one_year
  text: text("text").notNull(),
  writtenOn: date("written_on").notNull(),
}, (t) => [uniqueIndex("direction_user_horizon_idx").on(t.userId, t.horizon)]);

/* Ground truth: one row per sub-habit per day. Category and major
   totals are computed from these and stored alongside, never
   recomputed for history — so tuning a weight later cannot rewrite
   what last month looked like. */
export const habitScoreLog = pgTable("habit_score_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  category: text("category").notNull(),
  subHabitKey: text("sub_habit_key").notNull(),
  inputType: text("input_type").notNull(),          // tier | prayer | quantity
  rawValue: text("raw_value"),                      // tier key, or the number entered
  points: integer("points").notNull(),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("habit_log_user_date_sub_idx").on(t.userId, t.date, t.subHabitKey),
  index("habit_log_user_date_idx").on(t.userId, t.date),
]);

export const majorScoreLog = pgTable("major_score_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  foundation: integer("foundation").notNull(),
  responsibility: integer("responsibility").notNull(),
  growth: integer("growth").notNull(),
  overallStatus: text("overall_status").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("major_log_user_date_idx").on(t.userId, t.date)]);
