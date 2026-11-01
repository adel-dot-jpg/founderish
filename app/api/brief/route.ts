import { z } from "zod";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.object({ projectId: z.string().uuid().optional() });

// "Send brief now" (demo button); the daily schedule enqueues the same job.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  await recordEvent(parsed.data.projectId ?? null, "brief_requested", { via: "dashboard" });
  await enqueue(JOBS.briefSend, { projectId: parsed.data.projectId });
  return Response.json({ ok: true });
}
