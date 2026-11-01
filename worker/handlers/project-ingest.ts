import type { JobPayloads } from "@/lib/queue";

// TODO(A): ingestRepo() -> LLM extracts facts + pitch -> enqueue audiences.generate.
export default async function handle(data: JobPayloads["project.ingest"]) {
  console.log("[project.ingest] stub", data);
}
