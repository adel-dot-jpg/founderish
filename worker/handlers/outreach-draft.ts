import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue, JOBS, type JobPayloads } from "@/lib/queue";
import { appUrl } from "@/lib/env";
import { draftEmail, LINK_PLACEHOLDER } from "@/lib/prompts/draftEmail";
import { loadProject } from "./_context";

// Founder-voice draft per contact (up: advice/intro ask; down: feedback ask + tracked link) -> receipt.check.
export default async function handle({ projectId, contactId }: JobPayloads["outreach.draft"]) {
  const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, contactId));
  if (!contact) return;
  const existing = await db.select().from(schema.drafts).where(eq(schema.drafts.contactId, contactId));
  if (existing.some((d) => d.kind === "email")) return; // job retry

  const [audience] = contact.audienceId
    ? await db.select().from(schema.audiences).where(eq(schema.audiences.id, contact.audienceId))
    : [];
  const { project, table, pitch } = await loadProject(projectId);

  const out = await draftEmail({
    direction: contact.direction,
    projectName: project.name,
    pitch,
    factsText: table.text,
    audience: audience?.name ?? "General",
    contact,
  });

  let body = out.body;
  if (body.includes(LINK_PLACEHOLDER)) {
    const token = randomBytes(6).toString("base64url");
    await db.insert(schema.links).values({ token, projectId, contactId });
    body = body.replaceAll(LINK_PLACEHOLDER, `${appUrl()}/r/${token}`);
  }

  const [draft] = await db
    .insert(schema.drafts)
    .values({ projectId, contactId, kind: "email", subject: out.subject, body, factIds: table.resolve(out.facts_used), status: "checking" })
    .returning();
  await db.update(schema.contacts).set({ status: "drafted" }).where(eq(schema.contacts.id, contactId));
  await enqueue(JOBS.receiptCheck, { draftId: draft.id });
}
