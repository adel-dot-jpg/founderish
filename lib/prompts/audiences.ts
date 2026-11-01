// audiences.generate: 2-3 user niches to test (down) + the upward profile set (up), each with Apollo filters.
import { z } from "zod";
import { callJSON } from "../llm";

const SENIORITIES = ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "entry"] as const;

const Filters = z.object({
  person_titles: z.array(z.string()).describe("3-6 job titles as they appear on profiles, e.g. 'Engineering Manager'"),
  person_seniorities: z.array(z.enum(SENIORITIES)).optional(),
  q_keywords: z.string().optional().describe("At most 2 broad keywords, or omit"),
});

const Audience = z.object({
  name: z.string().describe("Short label, e.g. 'Junior devs at startups'"),
  description: z.string().describe("One sentence: who they are and why they'd care, based on the facts"),
  apollo_filters: Filters,
});

export const UP_PROFILES = [
  "Founders in this space",
  "Angels and VC scouts",
  "Accelerator staff",
  "Engineering leaders",
  "Community leads",
] as const;

const Output = z.object({
  down: z.array(Audience).describe("2 or 3 distinct candidate user audiences"),
  up: z.array(Audience.extend({ name: z.enum(UP_PROFILES) })).describe("Exactly one entry per upward profile"),
});

export type ProposedAudiences = z.infer<typeof Output>;

export function proposeAudiences(input: { pitch: string; factsText: string; location: string; hint?: string }) {
  return callJSON({
    schema: Output,
    system:
      "You are a startup go-to-market advisor. Pick audiences a student founder can realistically reach by email, described with Apollo people-search filters. Titles must be common real-world job titles so the search returns people. Keep filters broad enough to find at least 10 people.",
    prompt: `Project pitch: ${input.pitch}

FACTS:
${input.factsText}

Founder location: ${input.location}${input.hint ? `\nHint from a mentor: ${input.hint}` : ""}

Propose:
1. "down": 2-3 distinct user audiences who would plausibly use this project. Make them meaningfully different niches so we can see which responds best.
2. "up": one entry for each of these upward profiles (people who can open doors), with filters tuned to this project's space: ${UP_PROFILES.join("; ")}.`,
  });
}
