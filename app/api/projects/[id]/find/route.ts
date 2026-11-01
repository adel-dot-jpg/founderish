import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

// "Find people now": no audiences yet -> generate them from whatever facts exist (repo, website, resume, text),
// which then searches Apollo, ranks and drafts. Audiences exist -> fetch the next Apollo page for each one.
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/find">) {
  const { id } = await ctx.params;
  const audiences = await db.select({ id: schema.audiences.id }).from(schema.audiences).where(eq(schema.audiences.projectId, id));
  await recordEvent(id, "people_search_requested", { audiences: audiences.length });
  if (!audiences.length) await enqueue(JOBS.audiencesGenerate, { projectId: id });
  for (const a of audiences) await enqueue(JOBS.peopleFind, { projectId: id, audienceId: a.id, more: true });
  return Response.json({ ok: true, audiences: audiences.length });
}
