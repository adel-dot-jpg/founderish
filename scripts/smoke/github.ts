// Part 1: ingestRepo(TEST_REPO). Part 2 (--push): wait for a verified github_push event after you push.
import { and, eq, gt } from "drizzle-orm";
import { run, sleep } from "./_util";
import { ingestRepo } from "@/lib/github";
import { db, schema } from "@/lib/db";

run("github", async () => {
  const repo = process.env.TEST_REPO;
  if (!repo) throw new Error("TEST_REPO is not set");
  const p = await ingestRepo(repo);
  console.log(`  ${p.fullName}: ${p.stars} stars, readme ${p.readme?.length ?? 0} chars`);
  console.log(`  languages: ${Object.keys(p.languages).join(", ") || "none"}`);
  console.log(`  ${p.commits.length} commits, latest: ${p.commits[0]?.message.split("\n")[0] ?? "none"}`);
  console.log(`  ${p.files.length} files`);
  if (!p.commits.length) throw new Error("no commits returned");

  if (!process.argv.includes("--push")) return "ingest ok (re-run with -- --push to test the webhook)";

  const since = new Date();
  console.log("  waiting up to 5 minutes for a push to the default branch...");
  while (Date.now() - since.getTime() < 5 * 60_000) {
    const [ev] = await db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.type, "github_push"), gt(schema.events.createdAt, since)));
    if (ev) return `ingest ok; verified github_push event ${ev.id}`;
    await sleep(3000);
  }
  throw new Error("no github_push event within 5 minutes");
});
