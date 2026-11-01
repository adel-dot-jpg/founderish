import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";
import { verifyWebhook } from "@/lib/github";

type PushPayload = {
  ref?: string;
  repository?: { full_name: string; html_url: string; default_branch: string };
  commits?: { id: string; message: string; url: string }[];
  head_commit?: { id: string; message: string; url: string } | null;
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  const kind = req.headers.get("x-github-event");
  if (kind === "ping") return Response.json({ ok: true });
  if (kind !== "push") return Response.json({ ignored: kind });

  const body = JSON.parse(raw) as PushPayload;
  const repo = body.repository;
  if (!repo || body.ref !== `refs/heads/${repo.default_branch}`) return Response.json({ ignored: "not default branch" });

  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.repoUrl, repo.html_url));
  const event = await recordEvent(project?.id ?? null, "github_push", {
    repo: repo.full_name,
    verified: true,
    commits: (body.commits ?? []).map((c) => ({ id: c.id, message: c.message, url: c.url })),
  });
  if (project) await enqueue(JOBS.postDraft, { projectId: project.id, eventId: event.id });
  return Response.json({ ok: true, eventId: event.id });
}
