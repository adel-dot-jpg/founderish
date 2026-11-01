// Needs a human: reply to the smoke:agentboxd-send email. Waits up to 5 minutes.
// --webhook also registers APP_URL/api/webhooks/mail (APP_URL must be public HTTPS).
import { readFileSync } from "node:fs";
import { run, sleep } from "./_util";
import { getMessage, listInbound, parseInbound, registerInboundWebhook } from "@/lib/mail";
import { appUrl } from "@/lib/env";

run("agentboxd-receive", async () => {
  const sent = JSON.parse(readFileSync(".smoke/agentboxd-sent.json", "utf8")) as {
    messageId: string;
    threadId: string;
    to: string;
  };

  if (process.argv.includes("--webhook")) {
    const hook = await registerInboundWebhook(`${appUrl()}/api/webhooks/mail`);
    console.log(`  webhook registered: ${hook.url}`);
  }

  const original = await getMessage(sent.messageId);
  console.log(`  waiting for a reply from ${sent.to} in thread ${sent.threadId}...`);
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const reply = (await listInbound(25)).find((m) => m.thread_id === sent.threadId);
    if (reply) {
      const mail = parseInbound(reply);
      console.log(`  from: ${mail.from}\n  text: ${mail.text.slice(0, 200)}\n  labels: ${mail.labels.join(", ") || "none"}`);
      if (mail.threadId !== sent.threadId) throw new Error("thread mismatch");
      if (mail.inReplyTo && mail.inReplyTo !== original.rfc_message_id) {
        console.log(`  note: in_reply_to ${mail.inReplyTo} != original ${original.rfc_message_id}`);
      }
      return `reply parsed, thread ${mail.threadId} matches`;
    }
    await sleep(5000);
  }
  throw new Error("no reply within 5 minutes");
});
