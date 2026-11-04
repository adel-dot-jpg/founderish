"use client";

import { useState } from "react";
import { useRefreshFor } from "./live-refresh";

// A one-click POST that starts worker jobs: shows a working label and keeps the page fresh while they run.
export function ActionButton({
  url,
  body,
  label,
  busyLabel,
  watchMs = 30_000,
  small = false,
}: {
  url: string;
  body?: object;
  label: string;
  busyLabel: string;
  watchMs?: number;
  small?: boolean;
}) {
  const refreshFor = useRefreshFor();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function run() {
    setState("busy");
    const res = await fetch(url, {
      method: "POST",
      ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    }).catch(() => null);
    if (!res?.ok) return setState("error");
    refreshFor(watchMs, () => setState("idle"));
  }

  return (
    <button
      disabled={state === "busy"}
      onClick={run}
      className={`rounded-md border border-zinc-700 text-zinc-200 hover:border-zinc-500 disabled:opacity-60 ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
    >
      {state === "busy" ? busyLabel : state === "error" ? "Failed, try again" : label}
    </button>
  );
}
