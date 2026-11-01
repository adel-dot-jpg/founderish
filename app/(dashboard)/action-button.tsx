"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A one-click POST with a "working…" state and a delayed refresh to show the result.
export function ActionButton({ url, label, busyLabel, refreshAfterMs = 15000 }: { url: string; label: string; busyLabel: string; refreshAfterMs?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(url, { method: "POST" });
        setTimeout(() => (router.refresh(), setBusy(false)), refreshAfterMs);
      }}
      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
    >
      {busy ? busyLabel : label}
    </button>
  );
}
