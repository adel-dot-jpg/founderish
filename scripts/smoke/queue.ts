// Needs the worker running (`npm run worker` in another terminal).
import { and, eq, sql } from "drizzle-orm";
import { run, sleep } from "./_util";
import { db, schema } from "@/lib/db";
import { enqueue, getBoss, JOBS } from "@/lib/queue";

run("queue", async () => {
  const marker = `ping-${Date.now()}`;
  const started = Date.now();
  await enqueue(JOBS.ping, { marker });
  while (Date.now() - started < 10_000) {
    const rows = await db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.type, "pong"), sql`${schema.events.payload}->>'marker' = ${marker}`));
    if (rows.length) {
      await (await getBoss()).stop({ graceful: false });
      return `worker answered in ${Date.now() - started}ms`;
    }
    await sleep(250);
  }
  throw new Error("no pong within 10s. Is the worker running? (npm run worker)");
});
