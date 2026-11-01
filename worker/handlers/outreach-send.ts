import type { JobPayloads } from "@/lib/queue";

// TODO(C): mail.send() the approved draft, insert messages row, contact -> sent, draft -> sent.
export default async function handle(data: JobPayloads["outreach.send"]) {
  console.log("[outreach.send] stub", data);
}
