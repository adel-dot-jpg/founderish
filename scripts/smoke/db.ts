// Run via `npm run smoke:db`, which pushes the schema first.
import { eq } from "drizzle-orm";
import { run } from "./_util";
import { db, pool, schema } from "@/lib/db";

run("db", async () => {
  const marker = `smoke-${Date.now()}`;
  const [row] = await db.insert(schema.events).values({ type: "smoke_db", payload: { marker } }).returning();
  const [read] = await db.select().from(schema.events).where(eq(schema.events.id, row.id));
  if (read?.payload.marker !== marker) throw new Error("read back a different row");
  await db.delete(schema.events).where(eq(schema.events.id, row.id));
  await pool.end();
  return "insert/read/delete on events ok";
});
