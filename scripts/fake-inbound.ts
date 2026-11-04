// Dev tool: inject an inbound reply into the newest sent thread (or --thread <id>) exactly as the mail
// webhook/poller would, then let the worker handle it. Use it on a dev database: the reply it creates is fake.
// Usage: npm run fake:inbound -- "Love this, can we talk Thursday?" [--thread <threadId>] [--from <email>]
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, pool, schema } from "@/lib/db";
import { enqueue, getBoss, recordEvent, JOBS } from "@/lib/queue";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const text = process.argv[2];
  if (!text || text.startsWith("--")) throw new Error('usage: npm run fake:inbound -- "reply text" [--thread id] [--from email]');

  const [sent] = await db
    .select({ message: schema.messages, contact: schema.contacts })
    .from(schema.messages)
    .innerJoin(schema.contacts, eq(schema.messages.contactId, schema.contacts.id))
    .where(eq(schema.messages.direction, "out"))
    .orderBy(desc(schema.messages.sentAt))
    .limit(1);
  const threadId = arg("thread") ?? sent?.message.threadId;
  if (!threadId) throw new Error("no sent thread to reply to");

  const message = {
    id: `fake-${randomUUID()}`,
    thread_id: threadId,
    from: arg("from") ?? sent?.contact.email ?? "someone@example.com",
    subject: `Re: ${sent?.message.subject ?? ""}`,
    text,
    extracted_text: text,
    in_reply_to: null,
    labels: [],
  };
  const event = await recordEvent(null, "mail_received", { message, via: "fake" });
  await enqueue(JOBS.mailInbound, { eventId: event.id });
  console.log(`queued fake reply from ${message.from} in thread ${threadId} (event ${event.id})`);
  await (await getBoss()).stop({ graceful: false });
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
