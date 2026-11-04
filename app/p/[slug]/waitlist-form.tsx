"use client";

import { useState } from "react";

export function WaitlistForm({ slug, token }: { slug: string; token?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email, token }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  if (state === "done") {
    return <p className="rounded-md border border-brand/40 bg-brand/10 px-4 py-3 font-medium text-zinc-100">You&apos;re on the list. Thanks for the interest.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email"
          className="flex-1 rounded-md border border-zinc-700 bg-transparent px-3 py-2"
        />
        <button disabled={state === "sending"} className="rounded-md bg-brand px-4 py-2 font-medium text-black hover:brightness-110 disabled:opacity-50">
          {state === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {state === "error" && <p className="text-sm text-red-400">Something went wrong. Try again.</p>}
    </form>
  );
}
