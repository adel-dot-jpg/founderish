import type { WebhookEvent } from "agentboxd";
import { enqueue, recordEvent, JOBS } from "@/lib/queue";
import { parseInbound, verifyMailWebhook } from "@/lib/mail";

// Agentboxd inbound. Store the raw message and hand off; mail.inbound decides what it means.
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifyMailWebhook(req.headers.get("x-mailroom-signature"), req.headers.get("x-mailroom-timestamp"), raw);
  if (!ok) return Response.json({ error: "bad signature" }, { status: 401 });

  const body = JSON.parse(raw) as WebhookEvent;
  if (body.type !== "message.received") return Response.json({ ignored: body.type });

  const mail = parseInbound(body);
  const event = await recordEvent(null, "mail_received", { message: body.data.message, via: "webhook", from: mail.from });
  await enqueue(JOBS.mailInbound, { eventId: event.id });
  return Response.json({ ok: true });
}
