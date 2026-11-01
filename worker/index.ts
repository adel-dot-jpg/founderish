import "dotenv/config";
import { getBoss, recordEvent, enqueue, JOBS, type JobName } from "@/lib/queue";
import { listInbound, parseInbound } from "@/lib/mail";
import { handlers } from "./handlers";

const TZ = "America/Toronto";

async function main() {
  const boss = await getBoss();

  for (const name of Object.keys(handlers) as JobName[]) {
    const handle = handlers[name] as (data: unknown) => Promise<void>;
    await boss.work(name, { pollingIntervalSeconds: 1 }, async (jobs) => {
      for (const job of jobs) {
        console.log(`[worker] ${name} ${job.id}`);
        await handle(job.data);
      }
    });
  }

  // Daily coach runs (plan.md §8).
  await boss.schedule(JOBS.peopleFind, "0 9 * * *", {}, { tz: TZ });
  await boss.schedule(JOBS.nicheReport, "30 9 * * *", {}, { tz: TZ });
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

// Fallback for when the inbound webhook can't reach us: every 30s, turn new inbound mail into
// mail_received events, exactly as /api/webhooks/mail would. Only mail that arrives after boot.
function startMailPoll() {
  const bootedAt = Date.now();
  const seen = new Set<string>();
  const tick = async () => {
    try {
      for (const msg of await listInbound()) {
        if (seen.has(msg.id) || Date.parse(msg.created_at) < bootedAt) continue;
        seen.add(msg.id);
        const event = await recordEvent(null, "mail_received", { message: msg, via: "poll" });
        await enqueue(JOBS.mailInbound, { eventId: event.id });
        console.log(`[worker] polled inbound mail from ${parseInbound(msg).from}`);
      }
    } catch (err) {
      console.error("[worker] mail poll failed", err);
    }
  };
  setInterval(tick, 30_000);
  void tick();
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
