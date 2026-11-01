// receipt.check: list every claim, match it to a fact, and rewrite the draft without unsupported claims.
import { z } from "zod";
import { callJSON } from "../llm";

const Output = z.object({
  claims: z.array(
    z.object({
      claim: z.string(),
      kind: z
        .enum(["fact", "framing", "ask"])
        .describe("fact = states something about the project, founder, users, traction or partners; framing = the reader's problem in general terms; ask = call to action, offer, greeting or sign-off"),
      fact: z.string().nullable().describe("For kind=fact: label of the supporting fact (e.g. F2), or null if unsupported. Null for framing/ask."),
    }),
  ),
  revised_body: z
    .string()
    .nullable()
    .describe("Only if any claim is unsupported: the full email with those claims removed or softened into non-claims; otherwise null"),
});

export type ReceiptCheck = z.infer<typeof Output>;

export function checkReceipts(input: { subject: string | null; body: string; factsText: string }) {
  return callJSON({
    schema: Output,
    model: "fast",
    system: `You are a strict fact-checker for a founder's outreach. A "claim" is any statement of fact about the project, the founder, users, traction, metrics, funding, partners or credentials. Not claims: the ask or call to action ("try it", "reply if…"), the greeting, the sign-off, opinions about the recipient's role, links/URLs, hashtags, and general framing of the problem the reader faces (e.g. "hosts struggle with compliance") as long as it cites no numbers, studies or named customers.
A claim is supported only if a FACT directly states it. Close paraphrases are fine; inferences, rounding up and embellishment are not.
When rewriting, keep the voice, length, structure, ask, sign-off and any URL exactly as they are; only remove or neutralize unsupported claims.`,
    prompt: `FACTS:
${input.factsText}

EMAIL SUBJECT: ${input.subject ?? ""}
EMAIL BODY:
${input.body}`,
  });
}
