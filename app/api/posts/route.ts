import { z } from "zod";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.object({ projectId: z.string().uuid(), note: z.string().max(500).optional() });

// "Draft a post" button: record the request and let the worker write it.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const event = await recordEvent(parsed.data.projectId, "post_requested", { note: parsed.data.note ?? null });
  await enqueue(JOBS.postDraft, { projectId: parsed.data.projectId, eventId: event.id });
  return Response.json({ ok: true });
}
