import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { authPassed, needsHuman, parseInbound } from "@/lib/mail";
import { ownerEmail } from "@/lib/env";
import { parseBriefCommands } from "@/lib/brief-commands";
import { classifyReply } from "@/lib/prompts/classifyReply";
import { draftReply } from "@/lib/prompts/draftReply";
import { loadProject } from "./_context";

const STATUS_FOR = {
  interested: "replied",
  question: "replied",
  advice: "replied",
  meeting: "meeting",
  not_now: "dead",
  unsubscribe: "dead",
} as const;

// Inbound mail is untrusted. Thread match first (a teammate replying as a contact is a contact reply even from
// OWNER_EMAIL); unmatched mail from the owner with passing SPF/DMARC is a brief command.
export default async function handle({ eventId }: JobPayloads["mail.inbound"]) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) return;
  const mail = parseInbound(event.payload.message);

  // Classification is written last, so a retry after a failure resumes instead of skipping.
  const [seen] = await db.select().from(schema.messages).where(eq(schema.messages.providerMessageId, mail.messageId));
  if (seen?.classification) return;

  const [original] = await db
    .select({ message: schema.messages, contact: schema.contacts })
    .from(schema.messages)
    .innerJoin(schema.contacts, eq(schema.messages.contactId, schema.contacts.id))
    .where(and(eq(schema.messages.threadId, mail.threadId), eq(schema.messages.direction, "out")))
    .orderBy(desc(schema.messages.sentAt))
    .limit(1);

  if (!original) {
    if (mail.from === ownerEmail() && authPassed(mail)) return handleOwnerCommand(mail.text, mail.messageId);
    await recordEvent(null, "mail_unmatched", { from: mail.from, subject: mail.subject, eventId });
    return;
  }

  const { contact } = original;
  const projectId = contact.projectId;
  const [inbound] = seen
    ? [seen]
    : await db
        .insert(schema.messages)
        .values({ contactId: contact.id, direction: "in", threadId: mail.threadId, providerMessageId: mail.messageId, subject: mail.subject, body: mail.text })
        .returning();

  if (needsHuman(mail)) {
    await db.update(schema.messages).set({ classification: "needs_human" }).where(eq(schema.messages.id, inbound.id));
    await recordEvent(projectId, "reply_needs_human", { contactId: contact.id, labels: mail.labels });
    return;
  }

  const c = await classifyReply({ contact, ourEmail: original.message.body ?? "", reply: mail.text });
  await db.update(schema.contacts).set({ status: STATUS_FOR[c.classification] }).where(eq(schema.contacts.id, contact.id));
  // Flywheel: a positive reply is itself a receipt future pitches can use.
  if (!seen && c.new_fact && ["interested", "meeting", "advice"].includes(c.classification)) {
    await db.insert(schema.facts).values({ projectId, text: c.new_fact, sourceType: "reply" });
  }
  await recordEvent(projectId, "reply_received", { contactId: contact.id, name: contact.name, classification: c.classification, summary: c.summary });

  const markDone = async () => {
    await db.update(schema.messages).set({ classification: c.classification }).where(eq(schema.messages.id, inbound.id));
  };
  if (c.classification === "unsubscribe") return markDone();
  const { project, table } = await loadProject(projectId);
  const out = await draftReply({
    projectName: project.name,
    factsText: table.text,
    contactName: contact.name,
    classification: c.classification,
    thread: original.message.body ?? "",
    reply: mail.text,
  });
  const [draft] = await db
    .insert(schema.drafts)
    .values({
      projectId,
      contactId: contact.id,
      kind: "reply",
      subject: mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`,
      body: out.body,
      factIds: table.resolve(out.facts_used),
      status: "checking",
    })
    .returning();
  await markDone();
  await enqueue(JOBS.receiptCheck, { draftId: draft.id });
}

async function handleOwnerCommand(text: string, messageId: string) {
  const { approve, reject } = parseBriefCommands(text);
  if (!approve.length && !reject.length) {
    await recordEvent(null, "owner_mail_ignored", { messageId });
    return;
  }
  const numbers = [...approve, ...reject];
  const drafts = await db
    .select()
    .from(schema.drafts)
    .where(and(inArray(schema.drafts.briefNumber, numbers), eq(schema.drafts.status, "pending")));

  for (const d of drafts) {
    const ok = approve.includes(d.briefNumber!);
    await db.update(schema.drafts).set({ status: ok ? "approved" : "rejected" }).where(eq(schema.drafts.id, d.id));
    await recordEvent(d.projectId, ok ? "draft_approved" : "draft_rejected", { draftId: d.id, via: "email", briefNumber: d.briefNumber });
    if (ok && d.kind !== "post" && d.kind !== "connect_note") await enqueue(JOBS.outreachSend, { draftId: d.id });
  }
  await recordEvent(drafts[0]?.projectId ?? null, "owner_command", { approve, reject, matched: drafts.length });
}
