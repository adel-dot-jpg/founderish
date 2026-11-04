"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptChips } from "../receipt-chips";

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
  facts: string[];
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-900/40 text-amber-200",
  flagged: "bg-red-900/40 text-red-200",
  checking: "bg-zinc-800 text-zinc-300",
  approved: "bg-blue-900/40 text-blue-200",
  sent: "bg-green-900/40 text-green-200",
  rejected: "bg-zinc-800 text-zinc-500 line-through",
};
const STATUS_LABEL: Record<string, string> = { checking: "checking receipts", approved: "sending" };
const KIND_LABEL: Record<string, string> = { followup: "Follow-up", reply: "Reply" };

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
    <article className="rounded-lg border border-zinc-800 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {KIND_LABEL[draft.kind] && <span className="text-brand">{KIND_LABEL[draft.kind]} · </span>}
            {contact ? contact.name : "No contact"}
            {contact?.title && <span className="font-normal text-zinc-500"> · {contact.title}{contact.company ? ` at ${contact.company}` : ""}</span>}
          </p>
          <p className="text-sm text-zinc-500">
            {contact?.direction === "up" ? "⬆ Network" : "⬇ Users"}
            {audience && ` · ${audience}`}
            {contact?.score != null && ` · score ${contact.score}`}
            {contact?.email && ` · ${contact.email}`}
          </p>
          {contact?.reason && <p className="mt-1 text-sm italic text-zinc-400">{contact.reason}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[draft.status] ?? ""}`}>
          {draft.briefNumber != null && `#${draft.briefNumber} · `}
          {STATUS_LABEL[draft.status] ?? draft.status}
        </span>
      </header>

      <div className="mt-4 rounded-md bg-zinc-900 p-4 text-sm">
        {draft.subject && <p className="mb-2 font-medium">Subject: {draft.subject}</p>}
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.max(8, body.split("\n").length + 1)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-sans"
          />
        ) : (
          <p className="whitespace-pre-wrap">{draft.body}</p>
        )}
      </div>

      <ReceiptChips facts={facts} />

      {actionable && (
        <footer className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button disabled={busy} onClick={() => act({ action: "edit", body })} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
                Save and re-check receipts
              </button>
              <button disabled={busy} onClick={() => (setEditing(false), setBody(draft.body))} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              {draft.status === "pending" && (
                <button disabled={busy} onClick={() => act({ action: "approve" })} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
                  Approve &amp; send
                </button>
              )}
              <button disabled={busy} onClick={() => setEditing(true)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm">
                Edit
              </button>
              <button disabled={busy} onClick={() => act({ action: "reject" })} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-red-400">
                Reject
              </button>
            </>
          )}
          {error && <p className="w-full text-sm text-red-400">{error}</p>}
        </footer>
      )}
    </article>
  );
}
