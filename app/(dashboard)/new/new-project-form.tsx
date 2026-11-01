"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewProjectForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries([...f.entries()].filter(([, v]) => String(v).trim() !== ""));
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setBusy(false);
      return setError("Check the repo and site URL and try again.");
    }
    const project = (await res.json()) as { id: string };
    router.push(`/?project=${project.id}`);
  }

  const field = "rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        GitHub repo
        <input name="repoUrl" required placeholder="adel-dot-jpg/clauseforge or https://github.com/…" className={field} />
        <span className="text-xs text-zinc-500">Private repos work if your GITHUB_TOKEN can read them.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" placeholder="CedarKey" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Live site
        <input name="siteUrl" type="url" placeholder="https://cedarkey.ca" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        One line in your words (optional)
        <input name="description" placeholder="Province-specific short-term rental agreements for Canadian hosts" className={field} />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50">
          {busy ? "Creating…" : "Create and start the coach"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
