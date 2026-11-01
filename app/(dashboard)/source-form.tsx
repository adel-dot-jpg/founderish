"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "website" | "resume" | "text";

const TABS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "website", label: "Website", hint: "Your product site or portfolio. LinkedIn can't be read: use its “Save to PDF” export as a resume instead." },
  { kind: "resume", label: "Resume PDF", hint: "Your resume or LinkedIn's “Save to PDF” export. Education, roles and awards become receipts." },
  { kind: "text", label: "Paste text", hint: "Anything true you want it to know: your LinkedIn About section, a pitch, real customer numbers." },
];

export function SourceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("website");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "queued">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    let body: object;
    if (kind === "website") body = { projectId, kind, url };
    else if (kind === "text") body = { projectId, kind, text };
    else {
      if (!file) return setState("idle");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      body = { projectId, kind, filename: file.name, pdfBase64: btoa(bin) };
    }
    const res = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
      return setState("idle");
    }
    setState("queued");
    setUrl("");
    setText("");
    setFile(null);
    setTimeout(() => router.refresh(), 20000);
  }

  const tab = TABS.find((t) => t.kind === kind)!;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-4">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => (setKind(t.kind), setState("idle"), setError(null))}
            className={`rounded-md px-2.5 py-1 text-xs ${t.kind === kind ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{tab.hint}</p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        {kind === "website" && (
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cedarkey.ca" className="rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm" />
        )}
        {kind === "resume" && (
          <input type="file" required accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200" />
        )}
        {kind === "text" && (
          <textarea required minLength={20} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text…" className="rounded-md border border-zinc-700 bg-transparent px-3 py-1.5 text-sm" />
        )}
        <div className="flex items-center gap-3">
          <button disabled={state === "busy"} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
            {state === "busy" ? "Uploading…" : "Learn from this"}
          </button>
          {state === "queued" && <span className="text-xs text-zinc-400">Reading it now. New receipts appear below in about 20s.</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>
    </div>
  );
}
