import { Suspense } from "react";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentProject } from "@/lib/dashboard";
import { DraftCard } from "./draft-card";

export default function ApprovalsPage(props: PageProps<"/approvals">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-zinc-500">Nothing goes out until you approve it. Every claim is backed by a receipt.</p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Queue {...props} />
      </Suspense>
    </main>
  );
}

const ORDER = ["pending", "flagged", "checking", "approved", "sent", "rejected"] as const;

async function Queue({ searchParams }: PageProps<"/approvals">) {
  const project = await currentProject((await searchParams).project);
  if (!project) return <p className="text-zinc-500">No project yet.</p>;

  const rows = await db
    .select({ draft: schema.drafts, contact: schema.contacts, audience: schema.audiences })
    .from(schema.drafts)
    .leftJoin(schema.contacts, eq(schema.drafts.contactId, schema.contacts.id))
    .leftJoin(schema.audiences, eq(schema.contacts.audienceId, schema.audiences.id))
    .where(eq(schema.drafts.projectId, project.id))
    .orderBy(desc(schema.drafts.createdAt));

  const factIds = [...new Set(rows.flatMap((r) => r.draft.factIds))];
  const facts = factIds.length
    ? await db.select({ id: schema.facts.id, text: schema.facts.text }).from(schema.facts).where(inArray(schema.facts.id, factIds))
    : [];
  const factText = Object.fromEntries(facts.map((f) => [f.id, f.text]));

  rows.sort((a, b) => ORDER.indexOf(a.draft.status) - ORDER.indexOf(b.draft.status));
  const counts = ORDER.map((s) => [s, rows.filter((r) => r.draft.status === s).length] as const).filter(([, n]) => n);

  return (
    <>
      <p className="text-sm text-zinc-500">
        {project.name} · {counts.map(([s, n]) => `${n} ${s}`).join(" · ") || "no drafts yet"}
      </p>
      <div className="flex flex-col gap-4">
        {rows.map(({ draft, contact, audience }) => (
          <DraftCard
            key={draft.id}
            draft={{ id: draft.id, kind: draft.kind, status: draft.status, subject: draft.subject, body: draft.body, briefNumber: draft.briefNumber }}
            contact={contact && { name: contact.name, title: contact.title, company: contact.company, email: contact.email, score: contact.score, reason: contact.reason, direction: contact.direction }}
            audience={audience?.name ?? null}
            facts={draft.factIds.map((id) => ({ id, text: factText[id] ?? "(fact removed)" }))}
          />
        ))}
      </div>
    </>
  );
}
