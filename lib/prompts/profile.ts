// project.ingest: repo profile -> receipts (facts) + a one-line pitch.
import { z } from "zod";
import { callJSON } from "../llm";
import type { RepoProfile } from "../github";

const Output = z.object({
  pitch: z.string().describe("One problem-first sentence, under 25 words, using only the facts"),
  facts: z
    .array(
      z.object({
        text: z.string().describe("One short, specific, verifiable statement"),
        source: z.enum(["repo", "readme", "commit"]),
      }),
    )
    .describe("8 to 15 facts"),
});

export type ProfileFacts = z.infer<typeof Output>;

export function summarizeRepo(p: RepoProfile): string {
  const langs = Object.entries(p.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l)
    .join(", ");
  return [
    `Repository: ${p.fullName} (${p.url})`,
    `Description: ${p.description ?? "none"}`,
    `Topics: ${p.topics.join(", ") || "none"}`,
    `Languages: ${langs || "unknown"}`,
    `Stars: ${p.stars}, forks: ${p.forks}, created ${p.createdAt.slice(0, 10)}, last push ${p.pushedAt?.slice(0, 10) ?? "unknown"}`,
    `Commits fetched: ${p.commits.length}`,
    `Recent commit messages:\n${p.commits.slice(0, 30).map((c) => `- ${c.date?.slice(0, 10) ?? ""} ${c.message.split("\n")[0]}`).join("\n")}`,
    `Files (first 150):\n${p.files.slice(0, 150).join("\n")}`,
    `README:\n${(p.readme ?? "(no README)").slice(0, 12000)}`,
  ].join("\n\n");
}

export function extractFacts(profile: RepoProfile, ownerDescription?: string | null) {
  return callJSON({
    schema: Output,
    system:
      "You turn a GitHub repository into a list of verifiable facts (receipts) for a founder's outreach. Only state what the data below directly shows. No opinions, no projections, no adjectives like 'innovative' or 'powerful'. Prefer concrete facts: what it does, who it's for (only if stated), how it's built, what shipped recently.",
    prompt: `${summarizeRepo(profile)}${ownerDescription ? `\n\nOwner's own description of the project (treat as a stated fact): ${ownerDescription}` : ""}`,
  });
}
