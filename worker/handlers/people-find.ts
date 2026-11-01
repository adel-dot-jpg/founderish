import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { searchPeople, type ApolloPerson } from "@/lib/apollo";

// Apollo search (free) for one audience -> dedupe on (project, apollo_id) -> people.rank.
// With no audienceId (the daily schedule), fans out to every audience that isn't dropped.
export default async function handle({ projectId, audienceId, more }: JobPayloads["people.find"]) {
  if (!audienceId) {
    const audiences = await db
      .select()
      .from(schema.audiences)
      .where(projectId ? and(eq(schema.audiences.projectId, projectId), ne(schema.audiences.status, "dropped")) : ne(schema.audiences.status, "dropped"));
    for (const a of audiences) await enqueue(JOBS.peopleFind, { projectId: a.projectId, audienceId: a.id });
    return;
  }

  const [audience] = await db.select().from(schema.audiences).where(eq(schema.audiences.id, audienceId));
  if (!audience) return;
  // "Find more" asks Apollo for the next page instead of the same top results.
  const [{ n: known }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.contacts).where(eq(schema.contacts.audienceId, audience.id));
  const filters = { ...audience.apolloFilters, page: more ? Math.floor(known / (audience.apolloFilters.per_page ?? 10)) + 1 : 1 };

  let people: ApolloPerson[] = await searchPeople(filters);
  // Keyword filters often over-narrow; widen once if the search came back thin.
  if (people.length < 5 && filters.q_keywords) {
    const wider = await searchPeople({ ...filters, q_keywords: undefined });
    people = [...people, ...wider.filter((w) => !people.some((p) => p.apolloId === w.apolloId))];
  }

  const inserted = people.length
    ? await db
        .insert(schema.contacts)
        .values(
          people.map((p) => ({
            projectId: audience.projectId,
            direction: audience.direction,
            audienceId: audience.id,
            apolloId: p.apolloId,
            name: p.name,
            title: p.title,
            company: p.company,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: schema.contacts.id })
    : [];

  await recordEvent(audience.projectId, "people_found", { audience: audience.name, found: people.length, new: inserted.length });
  if (inserted.length) await enqueue(JOBS.peopleRank, { projectId: audience.projectId, contactIds: inserted.map((c) => c.id) });
}
