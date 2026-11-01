import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { send, SendBlockedError } from "@/lib/mail";

// Approved draft -> Agentboxd. Replies and follow-ups go into the contact's existing thread.
export default async function handle({ draftId }: JobPayloads["outreach.send"]) {
  const [draft] = await db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId));
  if (!draft || draft.status !== "approved" || !draft.contactId) return;
  const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, draft.contactId));
  if (!contact?.email) {
    await recordEvent(draft.projectId, "send_failed", { draftId, reason: "contact has no email" });
    return;
  }

  const [lastInbound] =
    draft.kind === "email"
      ? []
      : await db
          .select()
          .from(schema.messages)
          .where(and(eq(schema.messages.contactId, contact.id), eq(schema.messages.direction, "in")))
          .orderBy(desc(schema.messages.sentAt))
          .limit(1);

  try {
    const sent = await send({
      to: contact.email,
      subject: draft.subject ?? "",
      text: draft.body,
      replyToMessageId: lastInbound?.providerMessageId ?? undefined,
    });
    await db.insert(schema.messages).values({
      contactId: contact.id,
      direction: "out",
      threadId: sent.threadId,
      providerMessageId: sent.messageId,
      subject: draft.subject,
      body: draft.body,
    });
    await db.update(schema.drafts).set({ status: "sent" }).where(eq(schema.drafts.id, draftId));
    if (contact.status === "found" || contact.status === "drafted") {
      await db.update(schema.contacts).set({ status: "sent" }).where(eq(schema.contacts.id, contact.id));
    }
    await recordEvent(draft.projectId, "email_sent", { draftId, contactId: contact.id, to: contact.email, threadId: sent.threadId });
    if (draft.kind === "email") {
      const minutes = Number(process.env.FOLLOWUP_AFTER_MINUTES ?? 4 * 24 * 60);
      await enqueue(JOBS.followupSchedule, { contactId: contact.id }, { startAfter: Math.round(minutes * 60) });
    }
  } catch (err) {
    // The DEMO_MODE guard is final: record it instead of letting pg-boss retry.
    if (err instanceof SendBlockedError) {
      await recordEvent(draft.projectId, "send_blocked", { draftId, reason: err.message });
      return;
    }
    throw err;
  }
}
