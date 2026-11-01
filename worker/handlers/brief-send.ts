import type { JobPayloads } from "@/lib/queue";

// TODO(C): Number pending drafts (brief_number), add replies + niche update + suggested post -> email OWNER_EMAIL from the coach inbox.
export default async function handle(data: JobPayloads["brief.send"]) {
  console.log("[brief.send] stub", data);
}
