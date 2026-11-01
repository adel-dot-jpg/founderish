import type { JobPayloads } from "@/lib/queue";

// TODO(A): LLM scores 0-100 + one-line reason grounded in facts; keep top N -> enrich top picks -> enqueue outreach.draft.
export default async function handle(data: JobPayloads["people.rank"]) {
  console.log("[people.rank] stub", data);
}
