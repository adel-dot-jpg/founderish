"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Manual receipts: things the founder knows are true (launch date, real customers, program) that the repo can't show.
export function AddFactForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, text }),
    });
    setBusy(false);
    if (res.ok) {
      setText("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        minLength={8}
        placeholder="Add a true fact, e.g. “Launched publicly in October 2026”"
        className="flex-1 rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
      />
      <button disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
        Add receipt
      </button>
    </form>
  );
}
