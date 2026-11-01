// Agentboxd adapter (plan.md §6). The rest of the app only talks to these functions.
import { Agentboxd, verifyWebhook, type Message, type WebhookEvent } from "agentboxd";
import { isDemoMode, sendAllowlist } from "./env";

export class SendBlockedError extends Error {}

let client: Agentboxd | null = null;
const mr = () => (client ??= new Agentboxd());

let inbox: Promise<{ id: string; address: string }> | null = null;

// AGENTBOXD_INBOX names an existing inbox (needed for inbox-scoped keys). Without it we create one,
// idempotent on client_id, so it's safe to call on every boot.
async function resolveCoachInbox() {
  const wanted = process.env.AGENTBOXD_INBOX?.trim().toLowerCase();
  if (wanted) {
    const found = (await mr().inboxes.list()).data.find((i) => i.address.toLowerCase() === wanted || i.id === wanted);
    if (!found) throw new Error(`AGENTBOXD_INBOX ${wanted} is not visible to this API key`);
    return found;
  }
  return mr().inboxes.create({ client_id: "founderish-coach" });
}

export function getCoachInbox(): Promise<{ id: string; address: string }> {
  inbox ??= resolveCoachInbox()
    .then((i) => ({ id: i.id, address: i.address }))
    .catch((err) => {
      inbox = null;
      throw err;
    });
  return inbox;
}

export function emailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

function assertSendAllowed(to: string) {
  if (!isDemoMode()) return;
  const addr = emailAddress(to);
  if (!sendAllowlist().includes(addr)) {
    throw new SendBlockedError(`DEMO_MODE: refusing to send to ${addr} (not in SEND_ALLOWLIST)`);
  }
}

// The DEMO_MODE guard lives here, before any API call. Never move it to callers.
export async function send(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string; threadId: string }> {
  assertSendAllowed(input.to);
  const { id: inboxId } = await getCoachInbox();
  const msg = input.replyToMessageId
    ? await mr().messages.reply(inboxId, input.replyToMessageId, { text: input.text, html: input.html })
    : await mr().messages.send(inboxId, { to: input.to, subject: input.subject, text: input.text, html: input.html });
  return { messageId: msg.id, threadId: msg.thread_id };
}

export interface InboundMail {
  messageId: string;
  from: string;
  subject: string;
  text: string;
  threadId: string;
  inReplyTo: string | null;
  labels: string[];
}

// Accepts a webhook event body or a bare Agentboxd message (from polling).
export function parseInbound(raw: unknown): InboundMail {
  const body = raw as Partial<WebhookEvent> & Partial<Message>;
  const msg = (body.data?.message ?? body) as Message;
  if (!msg?.id || !msg.from) throw new Error("Not an Agentboxd message payload");
  return {
    messageId: msg.id,
    from: emailAddress(msg.from),
    subject: msg.subject ?? "",
    text: msg.extracted_text ?? msg.text ?? "",
    threadId: msg.thread_id,
    inReplyTo: msg.in_reply_to,
    labels: msg.labels ?? [],
  };
}

const RISK_LABELS = ["ai:injection-risk", "ai:phishing"];
const AUTH_FAIL_LABELS = ["spf-fail", "dmarc-fail", "dkim-fail"];

// Inbound mail is untrusted data. These mean "needs a human": never auto-draft from them.
export function needsHuman(mail: Pick<InboundMail, "labels">): boolean {
  return mail.labels.some((l) => RISK_LABELS.includes(l) || AUTH_FAIL_LABELS.includes(l));
}

export function authPassed(mail: Pick<InboundMail, "labels">): boolean {
  return !mail.labels.some((l) => AUTH_FAIL_LABELS.includes(l));
}

export function verifyMailWebhook(signature: string | null, timestamp: string | null, rawBody: string): boolean {
  const secret = process.env.AGENTBOXD_WEBHOOK_SECRET;
  if (!signature || !timestamp || !secret) return false;
  return verifyWebhook(signature, timestamp, rawBody, secret);
}

export async function registerInboundWebhook(url: string) {
  const { id: inboxId } = await getCoachInbox();
  const existing = (await mr().webhooks.list()).data.find((w) => w.url === url);
  if (existing) return existing;
  return mr().webhooks.create({
    url,
    events: ["message.received"],
    inbox_ids: [inboxId],
    secret: process.env.AGENTBOXD_WEBHOOK_SECRET,
  });
}

// Polling fallback (MAIL_INBOUND_MODE=poll).
export async function listInbound(limit = 25): Promise<Message[]> {
  const { id: inboxId } = await getCoachInbox();
  return (await mr().messages.list(inboxId, { direction: "inbound", limit })).data;
}

export async function listSent(limit = 10): Promise<Message[]> {
  const { id: inboxId } = await getCoachInbox();
  return (await mr().messages.list(inboxId, { direction: "outbound", limit })).data;
}

export async function getMessage(id: string): Promise<Message> {
  return mr().messages.get(id);
}
