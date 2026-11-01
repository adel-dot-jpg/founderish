"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  draft: { id: string; kind: string; status: string; subject: string | null; body: string; briefNumber: number | null };
  contact: {
    name: string;
    title: string | null;
    company: string | null;
    email: string | null;
    score: number | null;
    reason: string | null;
    direction: "up" | "down";
  } | null;
  audience: string | null;
  facts: { id: string; text: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  flagged: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  checking: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  approved: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  sent: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800",
};

export function DraftCard({ draft, contact, audience, facts }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);

  async function act(payload: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
    setEditing(false);
    router.refresh();
  }

  const actionable = draft.status === "pending" || draft.status === "flagged";

  return (
    <article className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {contact ? `${contact.name}` : "No contact"}
            {contact?.title && <span className="font-normal text-zinc-500"> · {contact.title}{contact.company ? ` at ${contact.company}` : ""}</span>}
          </p>
          <p className="text-sm text-zinc-500">
            {contact?.direction === "up" ? "⬆ Network" : "⬇ Users"}
            {audience && ` · ${audience}`}
            {contact?.score != null && ` · score ${contact.score}`}
            {contact?.email && ` · ${contact.email}`}
          </p>
          {contact?.reason && <p className="mt-1 text-sm italic text-zinc-600 dark:text-zinc-400">{contact.reason}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[draft.status] ?? ""}`}>
          {draft.briefNumber != null && `#${draft.briefNumber} · `}
          {draft.status}
        </span>
      </header>

      <div className="mt-4 rounded-md bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
        {draft.subject && <p className="mb-2 font-medium">Subject: {draft.subject}</p>}
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.max(8, body.split("\n").length + 1)}
            className="w-full rounded border border-zinc-300 bg-white p-2 font-sans dark:border-zinc-700 dark:bg-zinc-950"
          />
        ) : (
          <p className="whitespace-pre-wrap">{draft.body}</p>
        )}
      </div>

      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Receipts:</span>
          {facts.map((f, i) => (
            <span
              key={f.id}
              title={f.text}
              className="cursor-help rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            >
              ✓ {f.text.length > 48 ? `${f.text.slice(0, 48)}…` : f.text}
              <span className="sr-only"> (receipt {i + 1})</span>
            </span>
          ))}
        </div>
      )}

      {actionable && (
        <footer className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button disabled={busy} onClick={() => act({ action: "edit", body })} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">
                Save and re-check receipts
              </button>
              <button disabled={busy} onClick={() => (setEditing(false), setBody(draft.body))} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                Cancel
              </button>
            </>
          ) : (
            <>
              {draft.status === "pending" && (
                <button disabled={busy} onClick={() => act({ action: "approve" })} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  Approve &amp; send
                </button>
              )}
              <button disabled={busy} onClick={() => setEditing(true)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                Edit
              </button>
              {draft.status === "pending" && (
                <button disabled={busy} onClick={() => act({ action: "reject" })} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-red-600">
                  Reject
                </button>
              )}
            </>
          )}
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </footer>
      )}
    </article>
  );
}
