import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";
import { listInbound } from "@/lib/mail";

// One pass over the coach inbox ("Check inbox now" and the 30s poll): any inbound mail from the last 6 hours that
// hasn't been recorded yet becomes a mail_received event + mail.inbound job, exactly as the webhook would.
export default async function handle() {
  const since = Date.now() - 6 * 3_600_000;
  const fresh = (await listInbound(25)).filter((m) => Date.parse(m.created_at) > since);
  if (!fresh.length) return;
  const known = await db
    .select({ id: sql<string>`${schema.events.payload}->'message'->>'id'` })
    .from(schema.events)
    .where(sql`${schema.events.type} = 'mail_received' and ${schema.events.createdAt} > now() - interval '1 day'`);
  const seen = new Set(known.map((k) => k.id));
  for (const msg of fresh) {
    if (seen.has(msg.id)) continue;
    const event = await recordEvent(null, "mail_received", { message: msg, via: "poll" });
    await enqueue(JOBS.mailInbound, { eventId: event.id });
  }
}
