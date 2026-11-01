import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { ingestRepo } from "@/lib/github";
import { extractFacts } from "@/lib/prompts/profile";
import { loadProject } from "./_context";

// Repo -> facts (receipts) + pitch -> audiences.generate.
export default async function handle({ projectId }: JobPayloads["project.ingest"]) {
  const { project } = await loadProject(projectId);
  const profile = await ingestRepo(project.repoUrl);
  const { pitch, facts } = await extractFacts(profile, project.description);

  await db.transaction(async (tx) => {
    // Re-ingest replaces repo-derived facts; signup/reply/manual facts are kept.
    await tx
      .delete(schema.facts)
      .where(and(eq(schema.facts.projectId, projectId), inArray(schema.facts.sourceType, ["repo", "readme", "commit"])));
    await tx.insert(schema.facts).values(
      facts.map((f) => ({
        projectId,
        text: f.text,
        sourceType: f.source,
        sourceUrl: f.source === "commit" ? (profile.commits[0]?.url ?? profile.url) : profile.url,
      })),
    );
    await tx.update(schema.projects).set({ pitch }).where(eq(schema.projects.id, projectId));
  });

  await recordEvent(projectId, "project_ingested", { facts: facts.length, pitch });
  await enqueue(JOBS.audiencesGenerate, { projectId });
}
