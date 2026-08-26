"use client";

import { useActionState } from "react";
import { setupAccount, type FormState } from "@/app/actions";

export default function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setupAccount, null);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <p className="ar text-lg text-[var(--color-deen)]">بسم الله</p>
      <h1 className="mt-2 font-[family-name:var(--font-serif)] text-2xl">Ahmed OS</h1>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-[var(--color-faint)]">
        Deen first. Discipline always. Progress through consistency.
      </p>

      <form action={action} className="mt-8 space-y-4">
        <div>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" defaultValue="Ahmed" className="mt-1.5" required />
        </div>
        <div>
          <label htmlFor="passcode">Choose a passcode</label>
          <input id="passcode" name="passcode" type="password" minLength={4} className="mt-1.5" required
            autoComplete="new-password" />
          <p className="mt-1.5 text-[0.72rem] leading-relaxed text-[var(--color-faint)]">
            This is the only lock on the app. It is private data — choose something you will not forget,
            because there is no recovery email.
          </p>
        </div>
        {state?.error && <p className="text-[0.8rem] text-[var(--color-alert)]">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded bg-[var(--color-deen-dim)] px-4 py-2.5 text-[0.85rem] transition-colors hover:bg-[var(--color-deen)]/40 disabled:opacity-50">
          {pending ? "Setting up…" : "Begin"}
        </button>
      </form>
    </main>
  );
}
