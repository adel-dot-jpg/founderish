// Read helpers for dashboard pages (server components only).
import { desc, eq } from "drizzle-orm";
import { db, schema } from "./db";

// No auth: the dashboard shows one project at a time, ?project=<id> or the newest one.
export async function currentProject(projectId?: string | string[]) {
  const id = typeof projectId === "string" ? projectId : undefined;
  const [project] = id
    ? await db.select().from(schema.projects).where(eq(schema.projects.id, id))
    : await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).limit(1);
  return project ?? null;
}
