import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { ingestRepo, type RepoProfile } from "@/lib/github";
import { extractFacts } from "@/lib/prompts/profile";
import { loadProject } from "./_context";

// Repo -> facts (receipts) + pitch -> audiences.generate.
export default async function handle({ projectId }: JobPayloads["project.ingest"]) {
  const { project } = await loadProject(projectId);
  let profile: RepoProfile;
  try {
    profile = await ingestRepo(project.repoUrl);
  } catch (err) {
    // A typo or a private repo the token can't see won't fix itself on retry. Say so; the owner can grant access
    // and press "Re-read repo", or add other sources and use "Find people now" without the repo.
    const status = (err as { status?: number }).status;
    if (status !== 401 && status !== 403 && status !== 404) throw err;
    await recordEvent(projectId, "ingest_failed", { reason: status === 404 ? "not found, or GITHUB_TOKEN can't read it" : `GitHub returned ${status}` });
    return;
  }
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
