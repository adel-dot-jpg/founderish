// Read helpers for dashboard pages (server components only).
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "./db";

export const PROJECT_COOKIE = "fi_project";

// No auth: one project at a time. ?project=<id> wins, then the switcher's cookie, then the newest project.
export async function currentProject(projectId?: string | string[]) {
  const id = typeof projectId === "string" ? projectId : (await cookies()).get(PROJECT_COOKIE)?.value;
  if (id) {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    if (project) return project;
  }
  const [newest] = await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).limit(1);
  return newest ?? null;
}
