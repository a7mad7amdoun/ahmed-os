import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const db = await getDb();
  const users = await db.select().from(schema.users).limit(1);
  if (users.length) redirect("/login");
  return <SetupForm />;
}
