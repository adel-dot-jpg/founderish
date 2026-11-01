import type { JobPayloads } from "@/lib/queue";

// TODO(A): Founder-voice draft per contact (up: advice/intro ask; down: feedback ask + tracked link). Insert as status=checking -> enqueue receipt.check.
export default async function handle(data: JobPayloads["outreach.draft"]) {
  console.log("[outreach.draft] stub", data);
}
