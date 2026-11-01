import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { appUrl, ownerEmail } from "@/lib/env";
import { send } from "@/lib/mail";
import { nicheSnapshot } from "@/lib/niche";

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
  const leader = niche.find((n) => n.score > 0);

  const items = pending.map(({ draft, contact }, i) => ({
    n: i + 1,
    who: `${shortName(contact?.name)}${contact?.company ? ` · ${contact.company}` : ""}`,
    lane: draft.kind === "reply" ? "reply" : contact?.direction === "up" ? "network" : "users",
  }));
  const replyLines = replies.slice(0, 3).map((r) => `${shortName(r.payload.name as string)} (${r.payload.classification}): ${r.payload.summary}`);
  const url = `${appUrl()}/approvals`;
  const headline = pending.length ? `${pending.length} draft${pending.length === 1 ? "" : "s"} need your OK` : "Nothing needs you right now";

  const text = [
    `${headline}${replies.length ? ` · ${replies.length} new repl${replies.length === 1 ? "y" : "ies"}` : ""}`,
    "",
    ...items.map((i) => `${i.n}  ${i.who} (${i.lane})`),
    ...(items.length ? ["", `Reply "send 1 3" to approve or "skip 2" to drop.`] : []),
    ...(replyLines.length ? ["", ...replyLines] : []),
    ...(leader ? ["", `Leading niche: ${leader.name}`] : []),
    "",
    `Full drafts and receipts: ${url}`,
  ].join("\n");

  const sent = await send({
    to: ownerEmail(),
    subject: `founder(ish): ${headline.toLowerCase()}`,
    text,
    html: briefHtml({ project: project.name, headline, items, replyLines, leader: leader?.name ?? null, url }),
  });
  await recordEvent(project.id, "brief_sent", { threadId: sent.threadId, numbered: pending.length, replies: replies.length });
}

// "Jani Vr***k" -> "Jani V." (Apollo search obfuscates last names anyway)
function shortName(name?: string | null) {
  const [first, last] = (name ?? "?").split(" ");
  return last ? `${first} ${last[0]}.` : first;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Email-client-safe HTML: tables + inline styles, no images (they'd need a public URL).
function briefHtml(b: { project: string; headline: string; items: { n: number; who: string; lane: string }[]; replyLines: string[]; leader: string | null; url: string }) {
  const row = (cells: string) => `<tr>${cells}</tr>`;
  return `<!doctype html><html><body style="margin:0;background:#0d0d0d;padding:24px 12px;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#ededed">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:10px">
<tr><td style="padding:20px 24px 4px;font-family:Menlo,Consolas,monospace;font-weight:700;font-size:15px;letter-spacing:1px">FOUNDER<span style="background:#ff7f00;color:#000;border-radius:4px;padding:1px 4px;margin-left:2px">(ISH)</span></td></tr>
<tr><td style="padding:12px 24px 0;font-size:22px;font-weight:700">${esc(b.headline)}</td></tr>
<tr><td style="padding:2px 24px 14px;font-size:13px;color:#a1a1aa">${esc(b.project)}</td></tr>
${b.items.length ? `<tr><td style="padding:0 24px"><table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">
${b.items.map((i) => row(`<td style="padding:6px 0;width:28px;font-family:Menlo,Consolas,monospace;color:#ff7f00;font-weight:700">${i.n}</td><td style="padding:6px 0">${esc(i.who)}</td><td style="padding:6px 0;text-align:right;color:#a1a1aa;font-size:12px">${i.lane}</td>`)).join("")}
</table></td></tr>
<tr><td style="padding:10px 24px 0;font-size:13px;color:#a1a1aa">Reply <b style="color:#ededed">send 1 3</b> to approve or <b style="color:#ededed">skip 2</b> to drop.</td></tr>` : ""}
${b.replyLines.length ? `<tr><td style="padding:16px 24px 0;font-size:13px"><div style="color:#a1a1aa;margin-bottom:4px">New replies</div>${b.replyLines.map((l) => `<div style="padding:2px 0">${esc(l)}</div>`).join("")}</td></tr>` : ""}
${b.leader ? `<tr><td style="padding:16px 24px 0;font-size:13px;color:#a1a1aa">Leading niche: <span style="color:#ededed">${esc(b.leader)}</span></td></tr>` : ""}
<tr><td style="padding:20px 24px 24px"><a href="${b.url}" style="display:inline-block;background:#ff7f00;color:#000;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:6px;font-size:14px">Review drafts and receipts</a></td></tr>
</table></body></html>`;
}
