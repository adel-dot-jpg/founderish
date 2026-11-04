import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { trafficStats } from "@/lib/traffic";

// Turns live numbers into receipts. Each metric is one fact row keyed by source_url and updated in place,
// so drafts that cite it keep a valid fact id. Zero counts are never stated. Runs hourly, so the activity
// feed only hears about it when a number actually changed.
export default async function handle({ projectId }: JobPayloads["facts.refresh"]) {
  const projects = projectId
    ? await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
    : await db.select().from(schema.projects);

  for (const project of projects) {
    const s = await trafficStats(project.id, 7);
    const site = siteName(project);
    const metrics: [key: string, source: "traffic" | "signup", count: number, text: string][] = [
      ["visitors-7d", "traffic", s.visitors, `${site} had ${s.visitors} unique visitor${s.visitors === 1 ? "" : "s"} in the last 7 days.`],
      ["signups-7d", "traffic", s.signups, `${s.signups} ${s.signups === 1 ? "person" : "people"} signed up for ${project.name} in the last 7 days.`],
      ["waitlist", "signup", s.waitlist, `${s.waitlist} ${s.waitlist === 1 ? "person has" : "people have"} joined the ${project.name} early-access list.`],
    ];

    let changed = false;
    for (const [key, sourceType, count, text] of metrics) {
      const sourceUrl = `founderish:${key}`;
      const [existing] = await db
        .select()
        .from(schema.facts)
        .where(and(eq(schema.facts.projectId, project.id), eq(schema.facts.sourceUrl, sourceUrl)));
      if (count === 0) {
        if (!existing) continue;
        await db.delete(schema.facts).where(eq(schema.facts.id, existing.id));
      } else if (!existing) {
        await db.insert(schema.facts).values({ projectId: project.id, text, sourceType, sourceUrl });
      } else if (existing.text !== text) {
        await db.update(schema.facts).set({ text }).where(eq(schema.facts.id, existing.id));
      } else continue;
      changed = true;
    }
    if (changed) await recordEvent(project.id, "facts_refreshed", { visitors: s.visitors, signups: s.signups, waitlist: s.waitlist });
  }
}

function siteName(project: typeof schema.projects.$inferSelect) {
  return project.siteUrl ? new URL(project.siteUrl).hostname.replace(/^www\./, "") : project.name;
}
