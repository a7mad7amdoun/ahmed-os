import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const db = await getDb();
  const users = await db.select().from(schema.users).limit(1);
  if (!users.length) redirect("/setup");
  return <LoginForm name={users[0].name} />;
}
