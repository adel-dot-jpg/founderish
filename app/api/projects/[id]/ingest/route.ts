import { enqueue, recordEvent, JOBS } from "@/lib/queue";

// "Re-read repo": re-run project.ingest (e.g. after giving the GitHub token access to a private repo).
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/ingest">) {
  const { id } = await ctx.params;
  await recordEvent(id, "ingest_requested", {});
  await enqueue(JOBS.projectIngest, { projectId: id });
  return Response.json({ ok: true });
}
