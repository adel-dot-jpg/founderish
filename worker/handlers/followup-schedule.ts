import type { JobPayloads } from "@/lib/queue";

// TODO(C): 4 days after send with no reply: draft a follow-up. Cut first if behind.
export default async function handle(data: JobPayloads["followup.schedule"]) {
  console.log("[followup.schedule] stub", data);
}
