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
    });
    setState(res.ok ? "done" : "error");
  }

  if (state === "done") return <p className="font-medium">You&apos;re on the list.</p>;

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
      <button
        disabled={state === "sending"}
        className="rounded-md bg-brand px-4 py-2 font-medium text-black hover:brightness-110 disabled:opacity-50"
      >
        Join the waitlist
      </button>
      {state === "error" && <p className="text-red-600">Something went wrong. Try again.</p>}
    </form>
  );
}
