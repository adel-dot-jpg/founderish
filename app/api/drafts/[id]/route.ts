import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("edit"), subject: z.string().optional(), body: z.string().min(1) }),
]);

export async function PATCH(req: Request, ctx: RouteContext<"/api/drafts/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  const [draft] = await db.select().from(schema.drafts).where(eq(schema.drafts.id, id));
  if (!draft) return Response.json({ error: "not found" }, { status: 404 });

  if (input.action === "edit") {
    // Edited text goes back through the receipt check before it can be approved.
    const [updated] = await db
      .update(schema.drafts)
      .set({ body: input.body, subject: input.subject ?? draft.subject, status: "checking" })
      .where(eq(schema.drafts.id, id))
      .returning();
    await enqueue(JOBS.receiptCheck, { draftId: id });
    return Response.json(updated);
  }

  if (draft.status !== "pending") {
    return Response.json({ error: `draft is ${draft.status}, not pending` }, { status: 409 });
  }

  const status = input.action === "approve" ? "approved" : "rejected";
  const [updated] = await db.update(schema.drafts).set({ status }).where(eq(schema.drafts.id, id)).returning();
  await recordEvent(draft.projectId, `draft_${status}`, { draftId: id, via: "dashboard" });
  if (status === "approved" && draft.kind !== "post" && draft.kind !== "connect_note") {
    await enqueue(JOBS.outreachSend, { draftId: id });
  }
  return Response.json(updated);
}
