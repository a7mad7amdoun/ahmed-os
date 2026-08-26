import { redirect } from "next/navigation";
import { getDb, schema } from "../db";
import { getUserId } from "./auth";

/** Every page funnels through here: no account → setup, no session → login. */
export async function requirePage(): Promise<{ userId: number; name: string }> {
  const db = await getDb();
  const users = await db.select().from(schema.users).limit(1);
  if (!users.length) redirect("/setup");

  const uid = await getUserId();
  if (!uid) redirect("/login");
  return { userId: uid, name: users[0].name };
}
