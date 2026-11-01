// pg-boss client + job contract (plan.md §5). Job names are shared across the team; don't rename them.
import PgBoss from "pg-boss";
import { db, schema } from "./db";
import { databaseUrl } from "./env";

export const JOBS = {
  ping: "ping",
  projectIngest: "project.ingest",
  audiencesGenerate: "audiences.generate",
  peopleFind: "people.find",
  peopleRank: "people.rank",
  outreachDraft: "outreach.draft",
  receiptCheck: "receipt.check",
  outreachSend: "outreach.send",
  followupSchedule: "followup.schedule",
  mailInbound: "mail.inbound",
  postDraft: "post.draft",
  nicheReport: "niche.report",
  briefSend: "brief.send",
  factsRefresh: "facts.refresh",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export type JobPayloads = {
  "ping": { marker: string };
  "project.ingest": { projectId: string };
  "audiences.generate": { projectId: string; hint?: string };
  "people.find": { projectId?: string; audienceId?: string }; // no ids = every testing audience (daily run)
  "people.rank": { projectId: string; contactIds: string[] };
  "outreach.draft": { projectId: string; contactId: string };
  "receipt.check": { draftId: string };
  "outreach.send": { draftId: string };
  "followup.schedule": { contactId: string };
  "mail.inbound": { eventId: string }; // the raw inbound payload lives in events.payload
  "post.draft": { projectId: string; eventId?: string };
  "niche.report": { projectId?: string };
  "brief.send": { projectId?: string };
  "facts.refresh": { projectId?: string }; // live traffic/waitlist numbers -> facts (no projectId = all)
};

const g = globalThis as unknown as { __founderishBoss?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  g.__founderishBoss ??= (async () => {
    const boss = new PgBoss(databaseUrl());
    boss.on("error", (err) => console.error("[pg-boss]", err));
    await boss.start();
    // pg-boss v10 needs a queue to exist before send/work.
    for (const name of Object.values(JOBS)) {
      if (!(await boss.getQueue(name))) await boss.createQueue(name);
    }
    return boss;
  })();
  // Don't cache a failed start (e.g. a network blip): the next call retries.
  g.__founderishBoss.catch(() => (g.__founderishBoss = undefined));
  return g.__founderishBoss;
}

export async function enqueue<N extends JobName>(
  name: N,
  data: JobPayloads[N],
  options: PgBoss.SendOptions = {},
): Promise<string | null> {
  const boss = await getBoss();
  // LLM/API jobs can fail transiently (rate limits); retry with backoff before giving up.
  // expireInSeconds: a job orphaned by a crashed worker is retried after 5 min instead of pg-boss's default 15.
  return boss.send(name, data, { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 300, ...options });
}

// The only thing routes and webhooks should do: record the trigger, then hand off to the worker.
export async function recordEvent(
  projectId: string | null,
  type: string,
  payload: Record<string, unknown> = {},
) {
  const [event] = await db.insert(schema.events).values({ projectId, type, payload }).returning();
  return event;
}
