import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { enrichPeople } from "@/lib/apollo";
import { rankContacts } from "@/lib/prompts/rank";
import { loadProject } from "./_context";

// How many of the best contacts per audience get enriched and drafted. Kept low: every draft costs two LLM calls.
const TOP_N = { down: Number(process.env.TOP_N_DOWN ?? 2), up: Number(process.env.TOP_N_UP ?? 1) };
const MIN_SCORE = 40;

// LLM scores new contacts 0-100 with a one-line reason -> enrich the top picks -> outreach.draft.
export default async function handle({ projectId, contactIds }: JobPayloads["people.rank"]) {
  const contacts = await db.select().from(schema.contacts).where(inArray(schema.contacts.id, contactIds));
  if (!contacts.length) return;
  const [audience] = contacts[0].audienceId
    ? await db.select().from(schema.audiences).where(eq(schema.audiences.id, contacts[0].audienceId))
    : [];
  const { table, pitch } = await loadProject(projectId);

  const ranked = await rankContacts({
    pitch,
    factsText: table.text,
    audience: { name: audience?.name ?? "General", description: audience?.description ?? null, direction: contacts[0].direction },
    contacts,
  });
  for (const r of ranked) {
    await db.update(schema.contacts).set({ score: r.score, reason: r.reason }).where(eq(schema.contacts.id, r.id));
  }

  const top = ranked
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N[contacts[0].direction])
    .map((r) => contacts.find((c) => c.id === r.id)!)
    .filter((c) => !c.email); // never enrich twice

  const enriched = await enrichPeople(top.map((c) => c.apolloId!).filter(Boolean));
  for (const c of top) {
    const e = enriched.find((p) => p.apolloId === c.apolloId);
    if (!e?.email) continue;
    await db
      .update(schema.contacts)
      .set({ email: e.email, linkedinUrl: e.linkedinUrl ?? c.linkedinUrl, name: e.name || c.name })
      .where(eq(schema.contacts.id, c.id));
    await enqueue(JOBS.outreachDraft, { projectId, contactId: c.id });
  }

  await recordEvent(projectId, "people_ranked", { audience: audience?.name ?? null, ranked: ranked.length, picked: top.length });
}
