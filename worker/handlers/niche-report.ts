import type { JobPayloads } from "@/lib/queue";

// TODO(B): Per-audience aggregate (positive_replies*3 + signups*2 + clicks) / sent -> LLM recommendation; mark winner.
export default async function handle(data: JobPayloads["niche.report"]) {
  console.log("[niche.report] stub", data);
}
