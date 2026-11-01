// outreach.draft: founder-voice email. Up = advice/intro ask. Down = feedback/early-access ask with a tracked link.
import { z } from "zod";
import { callJSON } from "../llm";
import { FOUNDER_VOICE, signature } from "./voice";

const Output = z.object({
  subject: z.string().describe("Under 8 words, no clickbait"),
  body: z.string(),
  facts_used: z.array(z.string()).describe("Labels of every fact the email relies on, e.g. ['F1','F4']"),
});

export const LINK_PLACEHOLDER = "{{link}}";

export function draftEmail(input: {
  direction: "up" | "down";
  projectName: string;
  pitch: string;
  factsText: string;
  audience: string;
  contact: { name: string; title: string | null; company: string | null; reason: string | null };
}) {
  const firstName = input.contact.name.split(" ")[0];
  const ask =
    input.direction === "up"
      ? "Ask for one specific thing: 15 minutes of advice, or an intro to someone relevant. No link."
      : `Ask for honest feedback or to try it early. Include the placeholder ${LINK_PLACEHOLDER} exactly once, on its own line, where the link to the project page goes.`;

  return callJSON({
    schema: Output,
    system: FOUNDER_VOICE,
    prompt: `Project: ${input.projectName}
Pitch: ${input.pitch}

FACTS:
${input.factsText}

Write a cold email to ${input.contact.name}, ${input.contact.title ?? ""} at ${input.contact.company ?? "their company"} (audience: ${input.audience}).
Why them: ${input.contact.reason ?? "relevant to the project"}

Rules:
- Open with "Hi ${firstName}," then lead with the problem, not with who I am.
- ${input.direction === "up" ? "Under 120 words." : "Under 90 words."}
- ${ask}
- Talk about what the project does for someone like them, not how it's built. Skip frameworks, libraries and file names unless they're an engineering leader.
- Don't claim to know them or their work beyond their title and company.
- End with the sign-off "${signature()}" on its own line.`,
  });
}
