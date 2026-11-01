import { z } from "zod";
import { db, schema } from "@/lib/db";
import { recordEvent } from "@/lib/queue";

const Body = z.object({ projectId: z.string().uuid(), text: z.string().trim().min(8).max(300) });

// The owner adds a fact they can vouch for; it becomes a receipt future drafts may cite.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const [fact] = await db.insert(schema.facts).values({ ...parsed.data, sourceType: "manual" }).returning();
  await recordEvent(parsed.data.projectId, "fact_added", { factId: fact.id, text: fact.text });
  return Response.json(fact, { status: 201 });
}
