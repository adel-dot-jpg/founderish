// Read helpers for dashboard pages (server components only).
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "./db";

export const PROJECT_COOKIE = "fi_project";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No auth: one project at a time. ?project=<id> wins, then the switcher's cookie, then the newest project.
// A malformed id (stale cookie, hand-edited URL) falls through instead of reaching Postgres as a bad uuid.
export async function currentProject(projectId?: string | string[]) {
  const id = typeof projectId === "string" ? projectId : (await cookies()).get(PROJECT_COOKIE)?.value;
  if (id && UUID.test(id)) {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    if (project) return project;
  }
  const [newest] = await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).limit(1);
  return newest ?? null;
}
