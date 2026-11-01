// Seeds a demo project for TEST_REPO with a few manual facts and the seed contacts.
// TODO(D): pre-ingested facts, audiences, some sent messages/replies for the demo.
import "dotenv/config";
import { db, pool, schema } from "@/lib/db";
import { ownerEmail } from "@/lib/env";
import { parseRepo } from "@/lib/github";
import { SEED_PEOPLE } from "@/lib/apollo-seed";

async function main() {
  const { owner, repo } = parseRepo(process.env.TEST_REPO ?? "");
  const [project] = await db
    .insert(schema.projects)
    .values({
      slug: `${repo.toLowerCase()}-demo`,
      name: repo,
      repoUrl: `https://github.com/${owner}/${repo}`,
      description: "Demo project",
      ownerEmail: ownerEmail(),
    })
    .onConflictDoUpdate({ target: schema.projects.slug, set: { ownerEmail: ownerEmail() } })
    .returning();

  await db.insert(schema.facts).values([
    { projectId: project.id, text: `Open source on GitHub at ${project.repoUrl}`, sourceType: "repo", sourceUrl: project.repoUrl },
  ]);

  await db
    .insert(schema.contacts)
    .values(
      SEED_PEOPLE.map((p, i) => ({
        projectId: project.id,
        direction: i < 6 ? ("up" as const) : ("down" as const),
        apolloId: p.apolloId,
        name: p.name,
        title: p.title,
        company: p.company,
      })),
    )
    .onConflictDoNothing();

  console.log(`seeded ${project.slug} (${project.id})`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
