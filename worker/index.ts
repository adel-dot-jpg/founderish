import "dotenv/config";
import { getBoss, enqueue, JOBS, type JobName } from "@/lib/queue";
import { handlers } from "./handlers";

const TZ = "America/Toronto";

async function main() {
  const boss = await getBoss({ worker: true });

  for (const name of Object.keys(handlers) as JobName[]) {
    const handle = handlers[name] as (data: unknown) => Promise<void>;
    await boss.work(name, { pollingIntervalSeconds: 1 }, async (jobs) => {
      for (const job of jobs) {
        console.log(`[worker] ${name} ${job.id}`);
        try {
          await handle(job.data);
        } catch (err) {
          // pg-boss records the failure and retries; log it so it isn't silent.
          console.error(`[worker] ${name} ${job.id} failed:`, err instanceof Error ? err.message : err);
          throw err;
        }
      }
    });
  }

  // Daily coach runs (plan.md §8).
  await boss.schedule(JOBS.peopleFind, "0 9 * * *", {}, { tz: TZ });
  await boss.schedule(JOBS.briefSend, "0 10 * * *", {}, { tz: TZ });
  await boss.schedule(JOBS.factsRefresh, "0 * * * *", {}, { tz: TZ });

  if (process.env.MAIL_INBOUND_MODE === "poll") startMailPoll();

  console.log(`[worker] up: ${Object.keys(handlers).length} handlers`);

  const shutdown = async () => {
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Fallback for when the inbound webhook can't reach us: check the coach inbox every 30s (DB-deduped mail.poll).
function startMailPoll() {
  setInterval(() => void enqueue(JOBS.mailPoll, {}, { singletonKey: "mail-poll", singletonSeconds: 20, retryLimit: 0 }), 30_000);
}

// Network blips (DNS, resets) surface as stray errors from pg/pg-boss internals; log them and keep working.
const NETWORK_CODES = new Set(["ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "EAI_AGAIN"]);
process.on("unhandledRejection", (err) => console.error("[worker] unhandled rejection:", err));
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  console.error("[worker] uncaught exception:", err);
  if (!NETWORK_CODES.has(err.code ?? "")) process.exit(1);
});

function boot() {
  main().catch((err: NodeJS.ErrnoException) => {
    console.error("[worker] boot failed:", err.message);
    if (!NETWORK_CODES.has(err.code ?? "")) process.exit(1);
    setTimeout(boot, 5000);
  });
}
boot();
