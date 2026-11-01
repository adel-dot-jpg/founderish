import type { JobPayloads } from "@/lib/queue";

// TODO(A): LinkedIn post draft from new facts (push / milestone). Shown with Copy + Open LinkedIn.
export default async function handle(data: JobPayloads["post.draft"]) {
  console.log("[post.draft] stub", data);
}
