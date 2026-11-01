import { enqueue, JOBS } from "@/lib/queue";

// "Check inbox now": the worker reads the Agentboxd coach inbox immediately instead of waiting for the 30s poll.
export async function POST() {
  await enqueue(JOBS.mailPoll, {}, { retryLimit: 0 });
  return Response.json({ ok: true });
}
