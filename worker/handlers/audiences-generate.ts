import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { proposeAudiences } from "@/lib/prompts/audiences";
import { loadProject, ownerLocation } from "./_context";

// LLM proposes 2-3 user audiences (down) + the upward profile set (up) -> people.find per audience.
export default async function handle({ projectId, hint }: JobPayloads["audiences.generate"]) {
  const existing = await db.select().from(schema.audiences).where(eq(schema.audiences.projectId, projectId));
  if (existing.length && !hint) return; // already generated (job retry); a hint adds more on purpose

  const { table, pitch } = await loadProject(projectId);
  const location = ownerLocation();
  const out = await proposeAudiences({ pitch, factsText: table.text, location, hint });

  const rows = await db
    .insert(schema.audiences)
    .values([
      ...out.down.map((a) => ({ ...a, direction: "down" as const })),
      ...(hint ? [] : out.up.map((a) => ({ ...a, direction: "up" as const }))),
    ].map((a) => ({
      projectId,
      direction: a.direction,
      name: a.name,
      description: a.description,
      apolloFilters: { ...a.apollo_filters, person_locations: [location], per_page: 10 },
    })))
    .returning();

  await recordEvent(projectId, "audiences_generated", { audiences: rows.map((r) => `${r.direction}: ${r.name}`), hint: hint ?? null });
  for (const a of rows) await enqueue(JOBS.peopleFind, { projectId, audienceId: a.id });
}
