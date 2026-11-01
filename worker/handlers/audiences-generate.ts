import type { JobPayloads } from "@/lib/queue";

// TODO(A): LLM proposes 2-3 down audiences + the up profile set, each with Apollo filters -> enqueue people.find per audience.
export default async function handle(data: JobPayloads["audiences.generate"]) {
  console.log("[audiences.generate] stub", data);
}
