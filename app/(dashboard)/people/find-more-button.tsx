"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FindMoreButton({ projectId, audienceId }: { projectId: string; audienceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");

  async function find() {
    setState("busy");
    const res = await fetch("/api/people/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, audienceId }),
    });
    setState(res.ok ? "queued" : "idle");
    setTimeout(() => router.refresh(), 20000);
  }

  return (
    <button onClick={find} disabled={state !== "idle"} className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-60">
      {state === "queued" ? "Searching Apollo…" : "Find more"}
    </button>
  );
}
