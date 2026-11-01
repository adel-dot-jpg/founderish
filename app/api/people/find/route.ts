import { z } from "zod";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.object({ projectId: z.string().uuid(), audienceId: z.string().uuid() });

// "Find more" on /people: another Apollo search for one audience (next page of results).
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  await recordEvent(parsed.data.projectId, "people_search_requested", { audienceId: parsed.data.audienceId });
  await enqueue(JOBS.peopleFind, { projectId: parsed.data.projectId, audienceId: parsed.data.audienceId, more: true });
  return Response.json({ ok: true });
}
