import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { checkReceipts } from "@/lib/prompts/receiptCheck";
import { loadProject } from "./_context";

// Every claim must map to a fact. Unsupported claims get rewritten out (re-checked once); otherwise the draft is flagged.
export default async function handle({ draftId }: JobPayloads["receipt.check"]) {
  const [draft] = await db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId));
  if (!draft || draft.status !== "checking") return;
  const { table } = await loadProject(draft.projectId);

  let body = draft.body;
  let unsupported: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const check = await checkReceipts({ subject: draft.subject, body, factsText: table.text });
    unsupported = check.claims.filter((c) => !c.fact).map((c) => c.claim);
    if (!unsupported.length) {
      const factIds = [...new Set([...table.resolve(check.claims.map((c) => c.fact!)), ...draft.factIds])];
      await db.update(schema.drafts).set({ body, factIds, status: "pending" }).where(eq(schema.drafts.id, draftId));
      await recordEvent(draft.projectId, "receipt_passed", { draftId, rewritten: pass > 0, claims: check.claims.length });
      return;
    }
    if (!check.revised_body) break;
    body = check.revised_body;
  }

  await db.update(schema.drafts).set({ body, status: "flagged" }).where(eq(schema.drafts.id, draftId));
  await recordEvent(draft.projectId, "receipt_flagged", { draftId, unsupported });
}
