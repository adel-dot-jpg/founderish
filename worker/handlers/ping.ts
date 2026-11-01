import { recordEvent, type JobPayloads } from "@/lib/queue";

// Used by smoke:queue to prove the worker is consuming jobs.
export default async function handle(data: JobPayloads["ping"]) {
  await recordEvent(null, "pong", { marker: data.marker });
}
