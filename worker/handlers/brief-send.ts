import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { appUrl, ownerEmail } from "@/lib/env";
import { send } from "@/lib/mail";
import { nicheSnapshot } from "@/lib/niche";

type Group = { project: string; items: { n: number; who: string; lane: string }[]; leader: string | null };

// One brief for every project: numbered pending drafts (grouped by project), replies since the last brief and
// each project's leading niche, emailed to the owner from the coach inbox. The owner approves by replying
// "send 1 3" (handled in mail.inbound), so numbers are global and each brief replaces the last one's. No LLM calls.
export default async function handle({ projectId }: JobPayloads["brief.send"]) {
  const projects = await db.select().from(schema.projects).orderBy(asc(schema.projects.createdAt));
  if (!projects.length) return;

  const pending = await db
    .select({ draft: schema.drafts, contact: schema.contacts })
    .from(schema.drafts)
    .leftJoin(schema.contacts, eq(schema.drafts.contactId, schema.contacts.id))
    .where(eq(schema.drafts.status, "pending"))
    .orderBy(asc(schema.drafts.createdAt));
  const ordered = projects.flatMap((p) => pending.filter((r) => r.draft.projectId === p.id));

  await db.update(schema.drafts).set({ briefNumber: null }).where(isNotNull(schema.drafts.briefNumber));
  for (const [i, { draft }] of ordered.entries()) {
    await db.update(schema.drafts).set({ briefNumber: i + 1 }).where(eq(schema.drafts.id, draft.id));
  }

  const groups: (Group & { projectId: string })[] = [];
  for (const p of projects) {
    const items = ordered.flatMap(({ draft, contact }, i) =>
      draft.projectId === p.id ? [{ n: i + 1, who: `${shortName(contact?.name)}${contact?.company ? ` · ${contact.company}` : ""}`, lane: lane(draft.kind, contact?.direction) }] : [],
    );
    if (!items.length) continue;
    const leader = (await nicheSnapshot(p.id)).find((n) => n.score > 0)?.name ?? null;
    groups.push({ projectId: p.id, project: p.name, items, leader });
  }

  const [lastBrief] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.type, "brief_sent"))
    .orderBy(desc(schema.events.createdAt))
    .limit(1);
  const replies = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.type, "reply_received"), lastBrief ? gt(schema.events.createdAt, lastBrief.createdAt) : undefined))
    .orderBy(desc(schema.events.createdAt));

  const replyLines = replies.slice(0, 3).map((r) => `${shortName(r.payload.name as string)} (${r.payload.classification}): ${r.payload.summary}`);
  const url = `${appUrl()}/approvals`;
  const headline = ordered.length ? `${ordered.length} draft${ordered.length === 1 ? "" : "s"} need your OK` : "Nothing needs you right now";

  const text = [
    `${headline}${replies.length ? ` · ${replies.length} new repl${replies.length === 1 ? "y" : "ies"}` : ""}`,
    ...groups.flatMap((g) => ["", g.project, ...g.items.map((i) => `${i.n}  ${i.who} (${i.lane})`), ...(g.leader ? [`Leading niche: ${g.leader}`] : [])]),
    ...(groups.length ? ["", `Reply "send 1 3" to approve or "skip 2" to drop.`] : []),
    ...(replyLines.length ? ["", "New replies", ...replyLines] : []),
    "",
    `Full drafts and receipts: ${url}`,
  ].join("\n");

  const sent = await send({ to: ownerEmail(), subject: `founder(ish) brief: ${headline}`, text, html: briefHtml({ headline, groups, replyLines, url }) });

  // Show the brief in the activity feed of every project it covered (or the one that asked for it).
  const covered = groups.length ? groups.map((g) => g.projectId) : [projectId ?? projects.at(-1)!.id];
  for (const id of covered) {
    await recordEvent(id, "brief_sent", { threadId: sent.threadId, numbered: groups.find((g) => g.projectId === id)?.items.length ?? 0, replies: replies.length });
  }
}

function lane(kind: string, direction?: "up" | "down") {
  if (kind === "post") return "LinkedIn post";
  if (kind === "reply") return "reply";
  if (kind === "followup") return "follow-up";
  return direction === "up" ? "network" : "users";
}

// "Jani Vr***k" -> "Jani V." (Apollo search obfuscates last names anyway)
function shortName(name?: string | null) {
  const [first, last] = (name ?? "?").split(" ");
  return last ? `${first} ${last[0]}.` : first;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MONO = "font-family:Menlo,Consolas,monospace";
const MUTED = "color:#a1a1aa";

// Email-client-safe HTML: tables + inline styles, no images (they'd need a public URL).
function briefHtml(b: { headline: string; groups: Group[]; replyLines: string[]; url: string }) {
  const groups = b.groups
    .map(
      (g) => `<tr><td style="padding:16px 24px 2px;font-size:12px;letter-spacing:.5px;text-transform:uppercase;${MUTED}">${esc(g.project)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">
${g.items.map((i) => `<tr><td style="padding:6px 0;width:28px;${MONO};color:#ff7f00;font-weight:700">${i.n}</td><td style="padding:6px 0">${esc(i.who)}</td><td style="padding:6px 0;text-align:right;${MUTED};font-size:12px">${i.lane}</td></tr>`).join("")}
</table></td></tr>${g.leader ? `\n<tr><td style="padding:2px 24px 0;font-size:13px;${MUTED}">Leading niche: <span style="color:#ededed">${esc(g.leader)}</span></td></tr>` : ""}`,
    )
    .join("\n");
  return `<!doctype html><html><body style="margin:0;background:#0d0d0d;padding:24px 12px;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#ededed">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:10px">
<tr><td style="padding:20px 24px 4px;${MONO};font-weight:700;font-size:15px;letter-spacing:1px">FOUNDER<span style="background:#ff7f00;color:#000;border-radius:4px;padding:1px 4px;margin-left:2px">(ISH)</span></td></tr>
<tr><td style="padding:12px 24px 0;font-size:22px;font-weight:700">${esc(b.headline)}</td></tr>
${groups}
${b.groups.length ? `<tr><td style="padding:14px 24px 0;font-size:13px;${MUTED}">Reply <b style="color:#ededed">send 1 3</b> to approve or <b style="color:#ededed">skip 2</b> to drop.</td></tr>` : ""}
${b.replyLines.length ? `<tr><td style="padding:16px 24px 0;font-size:13px"><div style="${MUTED};margin-bottom:4px">New replies</div>${b.replyLines.map((l) => `<div style="padding:2px 0">${esc(l)}</div>`).join("")}</td></tr>` : ""}
<tr><td style="padding:20px 24px 24px"><a href="${b.url}" style="display:inline-block;background:#ff7f00;color:#000;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:6px;font-size:14px">Review drafts and receipts</a></td></tr>
</table></body></html>`;
}
