import type { JobPayloads } from "@/lib/queue";

// TODO(D): searchPeople() per audience (<=10) -> dedupe on (project_id, apollo_id) -> enqueue people.rank.
export default async function handle(data: JobPayloads["people.find"]) {
  console.log("[people.find] stub", data);
}
