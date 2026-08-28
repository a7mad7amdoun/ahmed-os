import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/* ─────────────────────────────────────────────────────────────
   One schema, two drivers.

   No DATABASE_URL  → PGlite, a real Postgres compiled to WASM,
                      stored in ./.data. Zero setup: clone and run.
   DATABASE_URL set → postgres-js against Neon/Supabase/Vercel.

   Same dialect both sides, so nothing about the SQL changes
   between the laptop and production.
   ───────────────────────────────────────────────────────────── */

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __ahmedosDb: Promise<DB> | undefined;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const migrationsFolder = "./drizzle";

  // Serverless filesystems are read-only, so a missing DATABASE_URL in
  // production must fail loudly rather than silently writing to a PGlite
  // file the host will discard. Serving a production build from a machine
  // with real disk — a laptop behind a tunnel — is the one case where that
  // is untrue, so the refusal is waivable explicitly and never by accident.
  if (!url && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "1") {
    throw new Error(
      "DATABASE_URL is required in production. Set it to your Postgres " +
      "connection string (Neon, Supabase or Vercel Postgres), or set " +
      "ALLOW_LOCAL_DB=1 to serve the on-disk PGlite database — only safe " +
      "where the filesystem actually persists.",
    );
  }

  if (url) {
    const [{ drizzle }, { migrate }, postgres] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
      import("postgres").then((m) => m.default),
    ]);
    // max:1 — a single-user app on serverless has no business
    // opening a pool per lambda.
    const client = postgres(url, { max: 1 });
    const db = drizzle(client, { schema });
    try {
      await migrate(db, { migrationsFolder });
    } catch (err) {
      console.error("[db] migration failed", err);
      throw err;
    }
    return db;
  }

  const [{ PGlite }, { drizzle }, { migrate }, fs, path] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("node:fs"),
    import("node:path"),
  ]);
  // PGlite creates its own data dir but not the parent.
  const dir = process.env.PGLITE_DIR ?? path.resolve(process.cwd(), ".data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}

/** Connection is memoised on globalThis so Next's dev hot-reload
 *  doesn't open a new database on every file save. */
export function getDb(): Promise<DB> {
  if (!global.__ahmedosDb) {
    // Don't cache a rejection: a transient failure at boot would
    // otherwise poison every later request until a full restart.
    global.__ahmedosDb = connect().catch((err) => {
      global.__ahmedosDb = undefined;
      throw err;
    });
  }
  return global.__ahmedosDb;
}

export { schema };
