import { z } from "zod";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";
import { ownerEmail } from "@/lib/env";
import { parseRepo } from "@/lib/github";

const Body = z.object({
  repoUrl: z.string().min(3),
  description: z.string().optional(),
  name: z.string().optional(),
  siteUrl: z.url().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid project" }, { status: 400 });
  const { repoUrl, description } = parsed.data;

  let owner: string, repo: string;
  try {
    ({ owner, repo } = parseRepo(repoUrl));
  } catch {
    return Response.json({ error: "That isn't a GitHub repo. Use owner/name or a github.com URL." }, { status: 400 });
  }
  const name = parsed.data.name ?? repo;
  const slug = `${slugify(name) || slugify(repo) || "project"}-${Math.random().toString(36).slice(2, 6)}`;

  const [project] = await db
    .insert(schema.projects)
    .values({ slug, name, repoUrl: `https://github.com/${owner}/${repo}`, siteUrl: parsed.data.siteUrl, description, ownerEmail: ownerEmail() })
    .returning();

  await recordEvent(project.id, "project_created", { repoUrl: project.repoUrl });
  await enqueue(JOBS.projectIngest, { projectId: project.id });
  return Response.json(project, { status: 201 });
}
