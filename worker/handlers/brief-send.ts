import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { appUrl, ownerEmail } from "@/lib/env";
import { send } from "@/lib/mail";

// Numbered list of pending drafts + replies since the last brief + a per-audience scoreboard, emailed to the owner
// from the coach inbox. The owner approves by replying "send 1 3" (handled in mail.inbound). No LLM calls.
export default async function handle({ projectId }: JobPayloads["brief.send"]) {
  const [project] = projectId
    ? await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
    : await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).limit(1);
  if (!project) return;

  const pending = await db
    .select({ draft: schema.drafts, contact: schema.contacts })
    .from(schema.drafts)
    .leftJoin(schema.contacts, eq(schema.drafts.contactId, schema.contacts.id))
    .where(and(eq(schema.drafts.projectId, project.id), eq(schema.drafts.status, "pending")))
    .orderBy(asc(schema.drafts.createdAt));

  // Numbers are global so "send 2" is never ambiguous: clear the previous brief's numbers first.
  await db.update(schema.drafts).set({ briefNumber: null }).where(isNotNull(schema.drafts.briefNumber));
  for (const [i, { draft }] of pending.entries()) {
    await db.update(schema.drafts).set({ briefNumber: i + 1 }).where(eq(schema.drafts.id, draft.id));
  }

  const [lastBrief] = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.projectId, project.id), eq(schema.events.type, "brief_sent")))
    .orderBy(desc(schema.events.createdAt))
    .limit(1);
  const replies = await db
    .select()
    .from(schema.events)
    .where(
      and(
        eq(schema.events.projectId, project.id),
        eq(schema.events.type, "reply_received"),
        lastBrief ? gt(schema.events.createdAt, lastBrief.createdAt) : undefined,
      ),
    );

  const niche = await nicheSnapshot(project.id);

  const lines = [
    `Your founder(ish) brief for ${project.name}`,
    "",
    pending.length
      ? `${pending.length} draft${pending.length === 1 ? "" : "s"} waiting for your OK. Reply "send 1 3" to approve or "skip 2" to drop.`
      : "Nothing waiting for approval.",
    "",
    ...pending.flatMap(({ draft, contact }, i) => [
      `${i + 1}. ${contact?.direction === "up" ? "[Network]" : "[Users]"} ${contact?.name ?? "?"}${contact?.title ? `, ${contact.title}` : ""}${contact?.company ? ` @ ${contact.company}` : ""}`,
      `   "${draft.subject ?? draft.kind}": ${draft.body.split("\n").find((l) => l.trim() && !/^hi\b/i.test(l.trim()))?.trim().slice(0, 140) ?? ""}`,
    ]),
    "",
    replies.length ? "Replies since the last brief:" : "No new replies since the last brief.",
    ...replies.map((r) => `- ${r.payload.name} (${r.payload.classification}): ${r.payload.summary}`),
    "",
    "Which audience is responding:",
    ...niche.map((n) => `- ${n.name}: ${n.sent} sent, ${n.replies} replies, ${n.clicks} clicks, ${n.signups} signups`),
    "",
    `Review everything: ${appUrl()}/approvals`,
  ];

  const sent = await send({
    to: ownerEmail(),
    subject: `founder(ish) brief: ${pending.length} to approve`,
    text: lines.join("\n"),
  });
  await recordEvent(project.id, "brief_sent", { threadId: sent.threadId, numbered: pending.length, replies: replies.length });
}

// Per user audience: outcomes so far. Shared with the niche view.
export async function nicheSnapshot(projectId: string) {
  const audiences = await db
    .select()
    .from(schema.audiences)
    .where(and(eq(schema.audiences.projectId, projectId), eq(schema.audiences.direction, "down")));
  if (!audiences.length) return [];
  const ids = audiences.map((a) => a.id);

  const contactStats = await db
    .select({
      audienceId: schema.contacts.audienceId,
      sent: sql<number>`count(*) filter (where ${schema.contacts.status} in ('sent','replied','meeting','dead'))`.mapWith(Number),
      replies: sql<number>`count(*) filter (where ${schema.contacts.status} in ('replied','meeting'))`.mapWith(Number),
    })
    .from(schema.contacts)
    .where(inArray(schema.contacts.audienceId, ids))
    .groupBy(schema.contacts.audienceId);

  const clicks = await db
    .select({ audienceId: schema.contacts.audienceId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.events)
    .innerJoin(schema.contacts, sql`${schema.contacts.id}::text = ${schema.events.payload}->>'contactId'`)
    .where(and(eq(schema.events.type, "link_click"), inArray(schema.contacts.audienceId, ids)))
    .groupBy(schema.contacts.audienceId);

  const signups = await db
    .select({ audienceId: schema.contacts.audienceId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.signups)
    .innerJoin(schema.links, eq(schema.signups.linkToken, schema.links.token))
    .innerJoin(schema.contacts, eq(schema.links.contactId, schema.contacts.id))
    .where(inArray(schema.contacts.audienceId, ids))
    .groupBy(schema.contacts.audienceId);

  return audiences
    .map((a) => {
      const s = contactStats.find((x) => x.audienceId === a.id);
      const sent = s?.sent ?? 0;
      const replies = s?.replies ?? 0;
      const c = clicks.find((x) => x.audienceId === a.id)?.n ?? 0;
      const g = signups.find((x) => x.audienceId === a.id)?.n ?? 0;
      // plan.md §6: (positive_replies*3 + signups*2 + clicks) / sent
      return { id: a.id, name: a.name, status: a.status, sent, replies, clicks: c, signups: g, score: sent ? (replies * 3 + g * 2 + c) / sent : 0 };
    })
    .sort((x, y) => y.score - x.score);
}
