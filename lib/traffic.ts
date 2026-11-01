// Live numbers from the founder's own site (/t.js beacons) and the founder(ish) waitlist.
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "./db";

export async function trafficStats(projectId: string, days = 7) {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = and(eq(schema.events.projectId, projectId), eq(schema.events.type, "traffic"), gt(schema.events.createdAt, since));

  const [totals] = await db
    .select({
      pageviews: sql<number>`count(*) filter (where ${schema.events.payload}->>'kind' = 'pageview')`.mapWith(Number),
      visitors: sql<number>`count(distinct ${schema.events.payload}->>'visitor')`.mapWith(Number),
      signups: sql<number>`count(distinct ${schema.events.payload}->>'visitor') filter (where ${schema.events.payload}->>'kind' = 'signup')`.mapWith(Number),
    })
    .from(schema.events)
    .where(where);

  const referrers = await db
    .select({ host: sql<string>`${schema.events.payload}->>'referrer'`, n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.events)
    .where(and(where, sql`${schema.events.payload}->>'referrer' is not null`))
    .groupBy(sql`${schema.events.payload}->>'referrer'`)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const daily = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${schema.events.createdAt}), 'YYYY-MM-DD')`, visitors: sql<number>`count(distinct ${schema.events.payload}->>'visitor')`.mapWith(Number) })
    .from(schema.events)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const [waitlist] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.signups)
    .where(eq(schema.signups.projectId, projectId));

  return { days, ...totals, referrers, daily, waitlist: waitlist.n };
}
