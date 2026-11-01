"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_STYLE: Record<string, string> = {
  checking: "bg-zinc-800 text-zinc-300",
  pending: "bg-amber-900/40 text-amber-200",
  flagged: "bg-red-900/40 text-red-200",
  approved: "bg-blue-900/40 text-blue-200",
  sent: "bg-green-900/40 text-green-200",
  rejected: "bg-zinc-800 text-zinc-500 line-through",
};
const STATUS_LABEL: Record<string, string> = { sent: "posted", approved: "ready to post", checking: "checking receipts" };

async function patch(id: string, payload: object) {
  const res = await fetch(`/api/drafts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return res.ok;
}

export function PostCard({ post, facts }: { post: { id: string; status: string; body: string }; facts: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function act(payload: object) {
    setBusy(true);
    if (await patch(post.id, payload)) router.refresh();
    setBusy(false);
  }

  async function copyAndOpen() {
    await navigator.clipboard.writeText(post.body);
    setCopied(true);
    // LinkedIn's share box; the text is also on the clipboard in case the prefill is dropped.
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(post.body)}`, "_blank", "noopener");
  }

  return (
    <article className="rounded-lg border border-zinc-800 p-5">
      <div className="flex justify-end">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[post.status] ?? ""}`}>{STATUS_LABEL[post.status] ?? post.status}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-100">{post.body}</p>
      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Receipts:</span>
          {facts.map((f, i) => (
            <span key={i} title={f} className="cursor-help rounded border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-200">
              ✓ {f.length > 48 ? `${f.slice(0, 48)}…` : f}
            </span>
          ))}
        </div>
      )}
      <footer className="mt-4 flex flex-wrap gap-2">
        {post.status === "pending" && (
          <>
            <button disabled={busy} onClick={() => act({ action: "approve" })} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
              Approve
            </button>
            <button disabled={busy} onClick={() => act({ action: "reject" })} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-red-400">
              Reject
            </button>
          </>
        )}
        {post.status === "approved" && (
          <>
            <button onClick={copyAndOpen} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110">
              {copied ? "Copied ✓ Opening LinkedIn…" : "Copy & open LinkedIn"}
            </button>
            <button disabled={busy} onClick={() => act({ action: "posted" })} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm">
              Mark as posted
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

export function DraftPostButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");

  async function draft(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, note: note || undefined }) });
    setState(res.ok ? "queued" : "idle");
    setNote("");
    setTimeout(() => router.refresh(), 15000);
  }

  return (
    <form onSubmit={draft} className="flex flex-wrap gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: what happened? e.g. “Shipped bulk sending today”"
        className="min-w-64 flex-1 rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
      />
      <button disabled={state === "busy"} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
        {state === "queued" ? "Drafting… (about 30s)" : "Draft a post"}
      </button>
    </form>
  );
}
