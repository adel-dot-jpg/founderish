import type { JobPayloads } from "@/lib/queue";

// TODO(A): List claims, match each to a fact_id; rewrite or flag unsupported ones. Passing drafts -> pending, else flagged.
export default async function handle(data: JobPayloads["receipt.check"]) {
  console.log("[receipt.check] stub", data);
}
