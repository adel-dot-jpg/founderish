// Which user audience (niche) responds best. Shared by the Niche page and the brief.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";

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
