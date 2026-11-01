// post.draft: a LinkedIn post in founder voice from the facts (and what just happened, e.g. a push).
import { z } from "zod";
import { callJSON } from "../llm";
import { FOUNDER_VOICE } from "./voice";

const Output = z.object({
  body: z.string(),
  facts_used: z.array(z.string()),
});

export function draftPost(input: { projectName: string; pitch: string; factsText: string; trigger: string; siteUrl: string | null }) {
  return callJSON({
    schema: Output,
    system: `${FOUNDER_VOICE}

You are writing a LinkedIn post, not an email: a strong first line that names the problem, short paragraphs, 60-150 words, no hashtag spam (at most 2 relevant hashtags at the end), no emojis, no "I'm thrilled to announce".`,
    prompt: `Project: ${input.projectName}
Pitch: ${input.pitch}${input.siteUrl ? `\nLink to include once at the end: ${input.siteUrl}` : ""}

FACTS:
${input.factsText}

What prompted this post: ${input.trigger}

Write the post. Build it around what's new, backed by the facts. If the facts include real traction (visitors, signups, replies), lead with it; never round up or extrapolate.`,
  });
}
