// people.rank: score contacts 0-100 for one audience with a one-line reason grounded in the facts.
import { z } from "zod";
import { callJSON } from "../llm";

const Output = z.object({
  ranked: z.array(
    z.object({
      contact: z.string().describe("The contact label, e.g. C3"),
      score: z.number().int().min(0).max(100),
      reason: z.string().describe("One line, under 20 words, connecting this person to the project"),
    }),
  ),
});

export type RankInput = { id: string; name: string; title: string | null; company: string | null };

export async function rankContacts(input: {
  pitch: string;
  factsText: string;
  audience: { name: string; description: string | null; direction: "up" | "down" };
  contacts: RankInput[];
}): Promise<{ id: string; score: number; reason: string }[]> {
  const labels = new Map(input.contacts.map((c, i) => [`C${i + 1}`, c.id]));
  const goal =
    input.audience.direction === "up"
      ? "how likely this person is to give useful advice, an intro, or support to a student founder with this project"
      : "how likely this person is to actually use this project and reply with feedback";

  const out = await callJSON({
    schema: Output,
    model: "fast",
    system: "You rank outreach contacts for a founder. Be decisive and specific. Reasons must reference the person's role and a concrete fact about the project, never invented details about the person.",
    prompt: `Project pitch: ${input.pitch}

FACTS:
${input.factsText}

Audience: ${input.audience.name}: ${input.audience.description ?? ""}
Score each contact 0-100 for ${goal}.

CONTACTS:
${input.contacts.map((c, i) => `[C${i + 1}] ${c.name}, ${c.title ?? "unknown title"} at ${c.company ?? "unknown company"}`).join("\n")}`,
  });

  return out.ranked
    .map((r) => ({ id: labels.get(r.contact.trim().toUpperCase()), score: r.score, reason: r.reason }))
    .filter((r): r is { id: string; score: number; reason: string } => !!r.id);
}
