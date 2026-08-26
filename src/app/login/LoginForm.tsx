"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/actions";

export default function LoginForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <p className="ar text-lg text-[var(--color-deen)]">السلام عليكم</p>
      <h1 className="mt-2 font-[family-name:var(--font-serif)] text-xl">Welcome back, {name}.</h1>
      <form action={action} className="mt-7 space-y-4">
        <div>
          <label htmlFor="passcode">Passcode</label>
          <input id="passcode" name="passcode" type="password" className="mt-1.5" required autoFocus
            autoComplete="current-password" />
        </div>
        {state?.error && <p className="text-[0.8rem] text-[var(--color-alert)]">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded bg-[var(--color-deen-dim)] px-4 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40 disabled:opacity-50">
          {pending ? "…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
