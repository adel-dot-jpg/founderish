import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";

const Body = z.object({ slug: z.string(), email: z.email(), token: z.string().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "invalid email" }, { status: 400 });
  const { slug, email, token } = parsed.data;

  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.slug, slug));
  if (!project) return Response.json({ error: "not found" }, { status: 404 });

  const [link] = token ? await db.select().from(schema.links).where(eq(schema.links.token, token)) : [];
  const [signup] = await db
    .insert(schema.signups)
    .values({ projectId: project.id, email: email.toLowerCase(), linkToken: link?.token ?? null })
    .onConflictDoNothing()
    .returning();

  if (signup) {
    await recordEvent(project.id, "signup", { signupId: signup.id, linkToken: link?.token ?? null, contactId: link?.contactId ?? null });
    await enqueue(JOBS.factsRefresh, { projectId: project.id }, { singletonKey: `facts-${project.id}`, singletonSeconds: 60 });
  }
  return Response.json({ ok: true });
}
