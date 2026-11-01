// Full pipeline in DEMO_MODE. Needs the web app (npm run dev) and worker (npm run worker) running.
import { eq, inArray } from "drizzle-orm";
import { run, sleep } from "./_util";
import { db, schema } from "@/lib/db";
import { appUrl, isDemoMode } from "@/lib/env";

run("e2e", async () => {
  if (!isDemoMode()) throw new Error("refusing to run with DEMO_MODE off");
  const res = await fetch(`${appUrl()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl: process.env.TEST_REPO, description: "e2e smoke test" }),
  });
  if (!res.ok) throw new Error(`POST /api/projects ${res.status}: ${await res.text()}`);
  const { id: projectId } = (await res.json()) as { id: string };

  const snapshot = async () => {
    const [facts, audiences, contacts, drafts] = await Promise.all([
      db.select().from(schema.facts).where(eq(schema.facts.projectId, projectId)),
      db.select().from(schema.audiences).where(eq(schema.audiences.projectId, projectId)),
      db.select().from(schema.contacts).where(eq(schema.contacts.projectId, projectId)),
      db.select().from(schema.drafts).where(eq(schema.drafts.projectId, projectId)),
    ]);
    return { facts, audiences, contacts, drafts };
  };

  const deadline = Date.now() + 3 * 60_000;
  let s = await snapshot();
  while (Date.now() < deadline && !s.drafts.some((d) => d.status === "pending")) {
    await sleep(3000);
    s = await snapshot();
  }
  console.log(`  facts ${s.facts.length}, audiences ${s.audiences.length}, contacts ${s.contacts.length}, drafts ${s.drafts.length}`);

  if (!s.facts.length) throw new Error("no facts (project.ingest)");
  if (!s.audiences.length) throw new Error("no audiences (audiences.generate)");
  if (!s.contacts.some((c) => c.score != null)) throw new Error("no ranked contacts (people.find / people.rank)");
  if (!s.drafts.some((d) => d.status === "pending")) throw new Error("no pending draft (outreach.draft / receipt.check)");

  const factIds = [...new Set(s.drafts.flatMap((d) => d.factIds))];
  const known = factIds.length
    ? await db.select({ id: schema.facts.id }).from(schema.facts).where(inArray(schema.facts.id, factIds))
    : [];
  const knownIds = new Set(known.map((f) => f.id));
  const bad = s.drafts.filter((d) => d.factIds.length === 0 || d.factIds.some((id) => !knownIds.has(id)));
  if (bad.length) throw new Error(`${bad.length} drafts have missing or invalid fact_ids`);
  return `project ${projectId}: pending drafts with valid receipts`;
});
