import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { draftFollowup } from "@/lib/prompts/draftEmail";
import { loadProject } from "./_context";

// Runs FOLLOWUP_AFTER_MINUTES after a send (default 4 days). No reply yet -> one follow-up draft for approval.
export default async function handle({ contactId }: JobPayloads["followup.schedule"]) {
  const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, contactId));
  if (!contact || contact.status !== "sent") return; // replied, booked or dead: nothing to follow up
  const existing = await db
    .select()
    .from(schema.drafts)
    .where(and(eq(schema.drafts.contactId, contactId), eq(schema.drafts.kind, "followup")));
  if (existing.length) return; // one follow-up per contact, never a sequence

  const [original] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.contactId, contactId), eq(schema.messages.direction, "out")))
    .orderBy(desc(schema.messages.sentAt))
    .limit(1);
  if (!original) return;

  const { facts, table } = await loadProject(contact.projectId);
  const newest = facts.filter((f) => f.createdAt > original.sentAt).at(-1) ?? null;
  const out = await draftFollowup({ factsText: table.text, newestFact: newest?.text ?? null, contactName: contact.name, original: original.body ?? "" });

  const [draft] = await db
    .insert(schema.drafts)
    .values({
      projectId: contact.projectId,
      contactId,
      kind: "followup",
      subject: original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject ?? ""}`,
      body: out.body,
      factIds: table.resolve(out.facts_used),
      status: "checking",
    })
    .returning();
  await recordEvent(contact.projectId, "followup_drafted", { draftId: draft.id, contactId, name: contact.name });
  await enqueue(JOBS.receiptCheck, { draftId: draft.id });
}
