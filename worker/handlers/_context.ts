import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { factTable } from "@/lib/prompts/voice";

// Project + its facts (the receipts), loaded fresh for every job so new signups/replies show up immediately.
export async function loadProject(projectId: string) {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!project) throw new Error(`project ${projectId} not found`);
  const facts = await db
    .select()
    .from(schema.facts)
    .where(eq(schema.facts.projectId, projectId))
    .orderBy(asc(schema.facts.createdAt));
  return { project, facts, table: factTable(facts), pitch: project.pitch ?? project.description ?? project.name };
}

export const ownerLocation = () => process.env.OWNER_LOCATION?.trim() || "Toronto, Canada";
