"use client";

import { useState } from "react";

export function SendBriefButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "queued" | "error">("idle");

  async function sendBrief() {
    setState("sending");
    const res = await fetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setState(res.ok ? "queued" : "error");
  }

  return (
    <button
      onClick={sendBrief}
      disabled={state === "sending"}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
    >
      {state === "queued" ? "Brief on its way ✓" : state === "error" ? "Failed, try again" : "Send brief now"}
    </button>
  );
}
