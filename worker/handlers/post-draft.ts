import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, recordEvent, JOBS, type JobPayloads } from "@/lib/queue";
import { draftPost } from "@/lib/prompts/draftPost";
import { loadProject } from "./_context";

// LinkedIn post draft from the facts, prompted by a GitHub push, a milestone, or the owner's "Draft a post" button.
// No LinkedIn API: once approved, the dashboard offers Copy + Open LinkedIn.
export default async function handle({ projectId, eventId }: JobPayloads["post.draft"]) {
  const { project, table, pitch } = await loadProject(projectId);
  const [event] = eventId ? await db.select().from(schema.events).where(eq(schema.events.id, eventId)) : [];

  let trigger = "The founder wants a progress update post.";
  if (event?.type === "github_push") {
    const commits = (event.payload.commits as { message: string }[] | undefined) ?? [];
    trigger = `New code was just shipped:\n${commits.map((c) => `- ${c.message.split("\n")[0]}`).join("\n") || "- (no commit messages)"}`;
  } else if (event?.type === "post_requested" && event.payload.note) {
    trigger = `The founder's note (treat as a stated fact): ${event.payload.note}`;
  }

  const out = await draftPost({ projectName: project.name, pitch, factsText: table.text, trigger, siteUrl: project.siteUrl });
  const [draft] = await db
    .insert(schema.drafts)
    .values({ projectId, kind: "post", body: out.body, factIds: table.resolve(out.facts_used), status: "checking" })
    .returning();
  await recordEvent(projectId, "post_drafted", { draftId: draft.id, trigger: event?.type ?? "manual" });
  await enqueue(JOBS.receiptCheck, { draftId: draft.id });
}
