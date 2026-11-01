import { z } from "zod";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.discriminatedUnion("kind", [
  z.object({ projectId: z.string().uuid(), kind: z.literal("website"), url: z.url() }),
  z.object({ projectId: z.string().uuid(), kind: z.literal("resume"), filename: z.string().max(200), pdfBase64: z.string().max(8_000_000) }),
  z.object({ projectId: z.string().uuid(), kind: z.literal("text"), text: z.string().trim().min(20).max(15_000) }),
]);

// Add a knowledge source; the worker extracts facts from it (routes never call the LLM).
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid source" }, { status: 400 });
  const { projectId, ...source } = parsed.data;
  if (source.kind === "website" && /(^|\.)linkedin\.com$/i.test(new URL(source.url).hostname)) {
    return Response.json({ error: "LinkedIn pages can't be read (login wall). Use “Save to PDF” on your profile and upload it as a resume, or paste your About section." }, { status: 400 });
  }
  const event = await recordEvent(projectId, "source_added", source);
  await enqueue(JOBS.sourceIngest, { eventId: event.id });
  return Response.json({ ok: true });
}
