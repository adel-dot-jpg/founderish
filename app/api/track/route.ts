import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

// Collector for /t.js beacons from the founder's own site. Public and cross-origin by design; stores only
// path, referrer host and an anonymous browser id.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

const Beacon = z.object({
  project: z.string().min(1).max(80),
  type: z.string().regex(/^[a-z_]{1,40}$/),
  path: z.string().max(300).optional(),
  referrer: z.string().max(500).nullable().optional(),
  visitor: z.string().max(64),
  props: z.record(z.string(), z.unknown()).optional(),
});

const projectIds = new Map<string, string | null>();

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (/bot|crawler|spider|headless/i.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204, headers: CORS });

  const parsed = Beacon.safeParse(JSON.parse((await req.text()) || "{}"));
  if (!parsed.success) return Response.json({ error: "bad beacon" }, { status: 400, headers: CORS });
  const b = parsed.data;

  if (!projectIds.has(b.project)) {
    const [p] = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.slug, b.project));
    projectIds.set(b.project, p?.id ?? null);
  }
  const projectId = projectIds.get(b.project);
  if (!projectId) return Response.json({ error: "unknown project" }, { status: 404, headers: CORS });

  let referrer: string | null = null;
  try {
    referrer = b.referrer ? new URL(b.referrer).hostname : null;
  } catch {}

  await recordEvent(projectId, "traffic", { kind: b.type, path: b.path ?? "/", referrer, visitor: b.visitor, props: b.props ?? {} });
  // A signup on the founder's own app is new traction: refresh the facts (debounced to once a minute).
  if (b.type === "signup") await enqueue(JOBS.factsRefresh, { projectId }, { singletonKey: `facts-${projectId}`, singletonSeconds: 60 });
  return new Response(null, { status: 204, headers: CORS });
}
